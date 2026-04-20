import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
  memo,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  InteractionManager,
  Keyboard,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Location from "expo-location";
import {
  CheckCircle,
  MapPinLine,
  Pencil,
  Phone,
  SealCheck,
  SealWarning,
  Warning,
  Lock,
  Eye,
  EyeSlash,
} from "phosphor-react-native";
import BackButton from "@/components/BackButton";
import Button from "@/components/Button";
import Header from "@/components/Header";
import Input from "@/components/Input";
import ModalWrapper from "@/components/ModalWrapper";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/themes";
import { useAuth } from "@/contexts/AuthContext";
import { usePets } from "@/contexts/PetContext";
import { getPetImage } from "@/services/imageService";
import { verticalScale } from "@/utils/styling";
import {
  classifyPetImage,
  PetMLFields,
  MLError,
  MLScores,
} from "@/services/mlService";
import {
  ML_LOW_CONFIDENCE_THRESHOLD as TRUST_SCORE_MIN,
  BREED_EXCELLENT,
  IMAGE_DISPLAY_MAX_PX,
  IMAGE_DISPLAY_QUALITY,
} from "@/config/mlConfig";
import UploadModal from "./UploadModal";

const OTHERS_ANIMALS = new Set(["rabbit", "hamster", "iguana", "goldfish"]);

function resolveCategory(rawCategory: string, breed?: string): { category: string; isOthersAnimal: boolean } {
  if (rawCategory === "Others") {
    return { category: "Others", isOthersAnimal: true };
  }
  const normalizedBreed = breed?.toLowerCase() ?? "";
  if (OTHERS_ANIMALS.has(normalizedBreed)) {
    return { category: "Others", isOthersAnimal: true };
  }
  return { category: rawCategory, isOthersAnimal: false };
}

type MLStatus = "idle" | "running" | "approved" | "rejected" | "error";

type MLDialogState =
  | { visible: false }
  | { visible: true; type: "loading" }
  | { visible: true; type: "approved"; fields: PetMLFields }
  | { visible: true; type: "rejected"; reason: string; errorCode?: string }
  | { visible: true; type: "error"; message: string };

interface PetFormData {
  name: string;
  category: string;
  breed: string;
  color: string;
  age: string;
  description: string;
  address: string;
  phone: string;
  displayPhone: boolean;
  image: { uri: string } | null;
}

interface TrustTier {
  color: string;
  label: string;
  sublabel: string;
}

function getTrustTier(score: number): TrustTier {
  if (score >= BREED_EXCELLENT) {
    return {
      color: "#34C759",
      label: "Excellent",
      sublabel: "Photo verified with high confidence",
    };
  }
  if (score >= TRUST_SCORE_MIN) {
    return {
      color: "#F5A623",
      label: "Good",
      sublabel: "Photo accepted — a clearer shot may improve this score",
    };
  }
  return {
    color: colors.red,
    label: "Low",
    sublabel: "Photo did not meet quality requirements",
  };
}

interface SignalChipProps {
  label: string;
  hint: string;
  value: number;
  color: string;
}

const SignalChip = memo(({ label, hint, value, color }: SignalChipProps) => (
  <View style={[ts.chip, { borderColor: color + "35", backgroundColor: color + "10" }]}>
    <Typo size={10} color={color} fontWeight="700">
      {label}
    </Typo>
    <Typo size={13} color={color} fontWeight="800">
      {value.toFixed(0)}%
    </Typo>
    <Typo size={9} color={colors.textLight} style={{ textAlign: "center" }}>
      {hint}
    </Typo>
  </View>
));

interface TrustScoreBadgeProps {
  scores: MLScores;
}

const TrustScoreBadge = memo(({ scores }: TrustScoreBadgeProps) => {
  const { trustScore, categoryConfidence, breedConfidence, authConfidence } = scores;
  const tier = getTrustTier(trustScore);

  return (
    <View style={ts.wrap}>
      <View style={ts.headline}>
        <SealCheck size={18} color={tier.color} weight="fill" />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Typo size={14} fontWeight="700" color={colors.text}>
              Photo Quality
            </Typo>
            <View style={[ts.tierPill, { backgroundColor: tier.color + "20", borderColor: tier.color }]}>
              <Typo size={12} fontWeight="800" color={tier.color}>
                {tier.label}
              </Typo>
            </View>
          </View>
          <Typo size={11} color={colors.textLight} style={{ marginTop: 2 }}>
            {tier.sublabel}
          </Typo>
        </View>
        <Typo size={20} fontWeight="800" color={tier.color}>
          {trustScore.toFixed(0)}
        </Typo>
      </View>
      <View style={ts.track}>
        <View
          style={[
            ts.fill,
            { width: `${Math.min(trustScore, 100)}%` as any, backgroundColor: tier.color },
          ]}
        />
      </View>
      <View style={ts.signalRow}>
        <SignalChip label="Authenticity" hint="Real photo check" value={authConfidence} color={colors.green} />
        <SignalChip label="Pet detected" hint="Is it a pet?" value={categoryConfidence} color={colors.primary} />
        {breedConfidence !== null && (
          <SignalChip label="Breed match" hint="Breed confidence" value={breedConfidence} color="#AF52DE" />
        )}
      </View>
    </View>
  );
});

const ts = StyleSheet.create({
  wrap: {
    backgroundColor: colors.backgroundDark,
    borderRadius: radius._17,
    padding: 14,
    gap: 10,
    marginTop: verticalScale(14),
  },
  headline: { flexDirection: "row", alignItems: "center" },
  tierPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1.5 },
  track: {
    height: 7,
    backgroundColor: colors.background,
    borderRadius: 99,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.text + "12",
  },
  fill: { height: "100%", borderRadius: 99 },
  signalRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    flex: 1,
    minWidth: 80,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 2,
  },
});

const ScoreCell = memo(({ label, val }: { label: string; val: number }) => (
  <View style={{ alignItems: "center", gap: 2 }}>
    <Typo size={10} color={colors.textLight}>
      {label}
    </Typo>
    <Typo size={13} fontWeight="700" color={colors.text}>
      {val.toFixed(0)}%
    </Typo>
  </View>
));

interface MLResultDialogProps {
  state: MLDialogState;
  onApprove: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}

const MLResultDialog = memo(({ state, onApprove, onRetry, onDismiss }: MLResultDialogProps) => {
  if (!state.visible) return null;

  const getRejectionTitle = (errorCode?: string): string => {
    switch (errorCode) {
      case "AI_GENERATED":
        return "AI-Generated Image Detected";
      case "UNSUPPORTED_BREED":
        return "Breed Not Recognized";
      case "LOW_CONFIDENCE":
        return "Pet Not Detected";
      case "BELOW_THRESHOLD":
        return "Photo Quality Too Low";
      case "INVALID_IMAGE":
        return "Invalid Image";
      default:
        return "Photo Not Accepted";
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onDismiss}>
      <View style={dlg.backdrop}>
        <View style={dlg.card}>
          {state.type === "loading" && (
            <>
              <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 16 }} />
              <Typo size={16} fontWeight="600" color={colors.text} style={dlg.center}>
                Verifying your pet photo…
              </Typo>
              <Typo size={13} color={colors.textLight} style={[dlg.center, { marginTop: 6 }]}>
                AI is analysing the image. This takes a few seconds.
              </Typo>
            </>
          )}

          {state.type === "approved" && (() => {
            const tier = getTrustTier(state.fields.scores.trustScore);
            return (
              <>
                <SealCheck size={56} color={colors.green} weight="fill" style={dlg.icon} />
                <Typo size={18} fontWeight="700" color={colors.text} style={dlg.title}>
                  Photo Verified ✓
                </Typo>
                {(
                  [
                    { label: "Animal", val: state.fields.category },
                    { label: "Breed", val: state.fields.breed !== "Unknown" ? state.fields.breed : null },
                    { label: "Authenticity", val: "Real photo ✓", color: colors.green },
                  ] as Array<{ label: string; val: string | null; color?: string }>
                )
                  .filter((r) => r.val)
                  .map((row) => (
                    <View key={row.label} style={dlg.row}>
                      <Typo size={13} color={colors.textLight}>
                        {row.label}
                      </Typo>
                      <Typo size={13} fontWeight="600" color={row.color ?? colors.text}>
                        {row.val!}
                      </Typo>
                    </View>
                  ))}
                <View style={dlg.row}>
                  <Typo size={13} color={colors.textLight}>
                    Photo Quality
                  </Typo>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Typo size={13} fontWeight="700" color={tier.color}>
                      {tier.label}
                    </Typo>
                    <Typo size={12} color={colors.textLight}>
                      ({state.fields.scores.trustScore.toFixed(0)}/100)
                    </Typo>
                  </View>
                </View>
                <View style={dlg.scoreRow}>
                  <ScoreCell label="Auth" val={state.fields.scores.authConfidence} />
                  <ScoreCell label="Pet" val={state.fields.scores.categoryConfidence} />
                  {state.fields.scores.breedConfidence !== null && (
                    <ScoreCell label="Breed" val={state.fields.scores.breedConfidence} />
                  )}
                </View>
                <Button onPress={onApprove} style={[dlg.btn, { backgroundColor: colors.green }]}>
                  <Typo color={colors.background} fontWeight="700">
                    Continue &amp; Save
                  </Typo>
                </Button>
              </>
            );
          })()}

          {state.type === "rejected" && (
            <>
              <SealWarning size={56} color={colors.red} weight="fill" style={dlg.icon} />
              <Typo size={18} fontWeight="700" color={colors.text} style={dlg.title}>
                {getRejectionTitle(state.errorCode)}
              </Typo>
              <Typo size={14} color={colors.textLight} style={dlg.body}>
                {state.reason}
              </Typo>
              <Button onPress={onRetry} style={[dlg.btn, { backgroundColor: colors.primary }]}>
                <Typo color={colors.background} fontWeight="700">
                  Upload a Different Photo
                </Typo>
              </Button>
              <TouchableOpacity onPress={onDismiss} style={{ marginTop: 14, alignSelf: "center" }}>
                <Typo size={13} color={colors.textLight}>
                  Cancel
                </Typo>
              </TouchableOpacity>
            </>
          )}

          {state.type === "error" && (
            <>
              <Warning size={56} color="#F5A623" weight="fill" style={dlg.icon} />
              <Typo size={18} fontWeight="700" color={colors.text} style={dlg.title}>
                Verification Unavailable
              </Typo>
              <Typo size={14} color={colors.textLight} style={dlg.body}>
                {state.message}
              </Typo>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
                <Button
                  onPress={onDismiss}
                  style={[dlg.btn, { flex: 1, backgroundColor: colors.backgroundDark }]}
                >
                  <Typo color={colors.text} fontWeight="600">
                    Cancel
                  </Typo>
                </Button>
                <Button onPress={onApprove} style={[dlg.btn, { flex: 1 }]}>
                  <Typo color={colors.background} fontWeight="700">
                    Save Anyway
                  </Typo>
                </Button>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
});

const dlg = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 22,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  icon: { alignSelf: "center" },
  center: { textAlign: "center" },
  title: { textAlign: "center", marginTop: 12, marginBottom: 16 },
  body: { textAlign: "center", lineHeight: 20, marginBottom: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundDark,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
    backgroundColor: colors.backgroundDark,
    borderRadius: 12,
    padding: 10,
  },
  btn: { marginTop: 20, borderRadius: radius._17 },
});

const AvatarOverlay = memo(({ status }: { status: MLStatus }) => {
  if (status === "idle") return null;

  const bgMap: Partial<Record<MLStatus, string>> = {
    running: colors.primary + "20",
    approved: colors.green + "20",
    rejected: colors.red + "20",
    error: "#F5A62320",
  };

  return (
    <View style={[av.ring, { backgroundColor: bgMap[status] ?? colors.backgroundDark }]}>
      {status === "running" && <ActivityIndicator size="small" color={colors.primary} />}
      {status === "approved" && <SealCheck size={16} color={colors.green} weight="fill" />}
      {status === "rejected" && <SealWarning size={16} color={colors.red} weight="fill" />}
      {status === "error" && <Warning size={16} color="#F5A623" weight="fill" />}
    </View>
  );
});

const av = StyleSheet.create({
  ring: {
    position: "absolute",
    top: -4,
    right: -4,
    borderRadius: 20,
    padding: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
});

interface LockedFieldProps {
  label: string;
  value: string;
  hint: string;
  locked: boolean;
}

const LockedField = memo(({ label, value, hint, locked }: LockedFieldProps) => (
  <View style={{ gap: spacingY._10 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Typo color={colors.text}>{label}</Typo>
      {locked && (
        <View style={lf.badge}>
          <Lock size={11} color={colors.textLight} weight="bold" />
          <Typo size={11} color={colors.textLight} style={{ marginLeft: 3 }}>
            Set by AI
          </Typo>
        </View>
      )}
    </View>
    <View style={[lf.field, locked && lf.locked]}>
      <Typo size={14} color={value ? colors.text : colors.textLight} style={{ flex: 1 }}>
        {value || hint}
      </Typo>
      {locked && <Lock size={14} color={colors.textLight} weight="bold" />}
    </View>
  </View>
));

const lf = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.backgroundDark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.backgroundDark,
    borderRadius: radius._17,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.background,
    minHeight: 50,
  },
  locked: { backgroundColor: colors.backgroundDark, borderColor: colors.backgroundDark, opacity: 0.85 },
});

interface PhoneFieldProps {
  value: string;
  displayPhone: boolean;
  onChangeText: (v: string) => void;
  onToggleDisplay: (v: boolean) => void;
}

const PhoneField = memo(({ value, displayPhone, onChangeText, onToggleDisplay }: PhoneFieldProps) => (
  <View style={{ gap: spacingY._10 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Phone size={15} color={colors.text} weight="duotone" />
      <Typo color={colors.text}>Phone Number</Typo>
      <Typo size={11} color={colors.textLight}>
        (optional)
      </Typo>
    </View>
    <Input placeholder="e.g. +91 98765 43210" value={value} onChangeText={onChangeText} keyboardType="phone-pad" />
    {value.trim().length > 0 && (
      <View style={ph.toggleRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          {displayPhone ? (
            <Eye size={16} color={colors.green} weight="bold" />
          ) : (
            <EyeSlash size={16} color={colors.textLight} weight="bold" />
          )}
          <View>
            <Typo size={13} fontWeight="600" color={displayPhone ? colors.green : colors.textLight}>
              {displayPhone ? "Visible to adopters" : "Hidden from adopters"}
            </Typo>
            <Typo size={11} color={colors.textLight}>
              {displayPhone ? "Adopters can see & call this number" : "Only you can see this number"}
            </Typo>
          </View>
        </View>
        <Switch
          value={displayPhone}
          onValueChange={onToggleDisplay}
          trackColor={{ false: colors.backgroundDark, true: colors.green + "60" }}
          thumbColor={displayPhone ? colors.green : colors.textLight}
          ios_backgroundColor={colors.backgroundDark}
        />
      </View>
    )}
  </View>
));

const ph = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.backgroundDark,
    borderRadius: radius._12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
});

interface SubmitGuardParams {
  mlStatus: MLStatus;
  petData: PetFormData;
  wordCount: number;
  loading: boolean;
  isEditMode: boolean;
}

interface SubmitGuardResult {
  canSubmit: boolean;
  hint: string;
}

function useSubmitGuard(p: SubmitGuardParams): SubmitGuardResult {
  return useMemo<SubmitGuardResult>(() => {
    if (p.loading) return { canSubmit: false, hint: "" };
    if (!p.petData.image) return { canSubmit: false, hint: "Upload a pet photo to continue" };
    if (p.mlStatus === "running") return { canSubmit: false, hint: "Verifying image…" };
    if (p.mlStatus === "rejected")
      return { canSubmit: false, hint: "Upload a different photo — this one was rejected" };
    if (!p.isEditMode && p.mlStatus !== "approved" && p.mlStatus !== "error")
      return { canSubmit: false, hint: "Waiting for photo verification" };
    if (!p.petData.name.trim()) return { canSubmit: false, hint: "Enter a name for your pet" };
    if (!p.petData.breed.trim()) return { canSubmit: false, hint: "Breed will be filled once photo is verified" };
    if (!p.petData.address.trim()) return { canSubmit: false, hint: "Set a location using Get Location" };
    if (p.wordCount < 5) {
      const need = 5 - p.wordCount;
      return { canSubmit: false, hint: `Add ${need} more word${need !== 1 ? "s" : ""} to the description` };
    }
    return { canSubmit: true, hint: "" };
  }, [p.mlStatus, p.petData, p.wordCount, p.loading, p.isEditMode]);
}

const PetListModal = () => {
  const petContext = usePets();
  const { addPet, updatePet, pets } = petContext;
  const { user } = useAuth();
  const router = useRouter();
  const { id, mode } = useLocalSearchParams<{ id?: string; mode?: string }>();
  const isEditMode = mode === "edit";

  const isMounted = useRef(true);
  const isSubmitting = useRef(false);
  const navigationLock = useRef(false);
  const mlPromiseRef = useRef<Promise<PetMLFields> | null>(null);
  const mlResultRef = useRef<PetMLFields | null>(null);

  const [petData, setPetData] = useState<PetFormData>({
    name: "",
    category: "Dogs",
    breed: "",
    color: "",
    age: "",
    description: "",
    address: "",
    phone: "",
    displayPhone: false,
    image: null,
  });

  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [locationFetched, setLocationFetched] = useState(false);

  const [mlDialog, setMLDialog] = useState<MLDialogState>({ visible: false });
  const [mlStatus, setMLStatus] = useState<MLStatus>("idle");
  const [mlScores, setMLScores] = useState<MLScores | null>(null);

  const handleNameChange = useCallback((v: string) => setPetData((p) => ({ ...p, name: v })), []);
  const handleColorChange = useCallback((v: string) => setPetData((p) => ({ ...p, color: v })), []);
  const handleAgeChange = useCallback((v: string) => setPetData((p) => ({ ...p, age: v })), []);
  const handleDescriptionChange = useCallback((v: string) => setPetData((p) => ({ ...p, description: v })), []);
  const handlePhoneChange = useCallback((v: string) => setPetData((p) => ({ ...p, phone: v })), []);
  const handleDisplayPhoneToggle = useCallback((v: boolean) => setPetData((p) => ({ ...p, displayPhone: v })), []);

  useEffect(() => {
    isMounted.current = true;
    const task = InteractionManager.runAfterInteractions(async () => {
      if (!isMounted.current) return;
      if (isEditMode && id) {
        const summary = pets.find((p: any) => p.id === id);
        let details: any;
        if (typeof (petContext as any).getPetDetails === "function") {
          try {
            details = await (petContext as any).getPetDetails(id);
          } catch {}
        }
        if (summary && isMounted.current) {
          setPetData({
            name: summary.name ?? "",
            category: summary.category ?? "Dogs",
            breed: summary.breed ?? "",
            color: details?.coatcolor ?? "",
            age: details?.age != null ? String(details.age) : "",
            description: details?.description ?? "",
            address: details?.address ?? "",
            phone: details?.phone ?? "",
            displayPhone: details?.displayPhone ?? false,
            image: summary.image ?? null,
          });
          setLocationFetched(!!details?.address);
          setMLStatus("approved");
        }
      }
      setIsReady(true);
    });
    return () => {
      isMounted.current = false;
      task.cancel();
    };
  }, [id, mode, isEditMode, petContext]);

  const wordCount = useMemo(() => {
    const t = (petData.description ?? "").trim();
    return t.length > 0 ? t.split(/\s+/).length : 0;
  }, [petData.description]);

  const { canSubmit, hint } = useSubmitGuard({
    mlStatus,
    petData,
    wordCount,
    loading,
    isEditMode,
  });

  const processImageAndStartML = useCallback(async (uri: string): Promise<void> => {
    mlPromiseRef.current = null;
    mlResultRef.current = null;
    setMLStatus("running");
    setMLScores(null);

    let displayUri = uri;
    try {
      const r = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: IMAGE_DISPLAY_MAX_PX } }],
        { compress: IMAGE_DISPLAY_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
      );
      displayUri = r.uri;
    } catch {}

    if (!isMounted.current) return;
    setPetData((p) => ({ ...p, image: { uri: displayUri }, category: "Dogs", breed: "" }));

    const promise = classifyPetImage(uri);
    mlPromiseRef.current = promise;

    promise
      .then((result) => {
        if (!isMounted.current) return;
        mlResultRef.current = result;
        setPetData((p) => {
          const { category, isOthersAnimal } = resolveCategory(result.category, result.breed);
          return {
            ...p,
            category,
            breed: isOthersAnimal ? result.breed : result.breed !== "Unknown" ? result.breed : p.breed,
          };
        });
        setMLScores(result.scores);
        setMLStatus("approved");
      })
      .catch((err: unknown) => {
        if (!isMounted.current) return;
        const isInfraError =
          err instanceof MLError &&
          (["NETWORK", "TIMEOUT", "SERVER_UNAVAILABLE"] as MLError["code"][]).includes(err.code);
        setMLStatus(isInfraError ? "error" : "rejected");
      });
  }, []);

  const handleCameraPress = useCallback(async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1.0,
      });
      if (!result.canceled && isMounted.current) {
        setLoading(true);
        await processImageAndStartML(result.assets[0].uri);
        if (isMounted.current) setLoading(false);
      }
    } finally {
      if (isMounted.current) setModalVisible(false);
    }
  }, [processImageAndStartML]);

  const handleGalleryPress = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1.0,
      });
      if (!result.canceled && isMounted.current) {
        setLoading(true);
        await processImageAndStartML(result.assets[0].uri);
        if (isMounted.current) setLoading(false);
      }
    } finally {
      if (isMounted.current) setModalVisible(false);
    }
  }, [processImageAndStartML]);

  const handleRemovePress = useCallback(() => {
    mlPromiseRef.current = null;
    mlResultRef.current = null;
    setMLStatus("idle");
    setMLScores(null);
    setPetData((p) => ({ ...p, image: null, category: "Dogs", breed: "" }));
  }, []);

  const handleFetchLocation = useCallback(async () => {
    if (locationLoading || !isMounted.current) return;
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location access is required to set the pet's address.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const reverse = await Location.reverseGeocodeAsync(loc.coords);
      if (reverse.length > 0 && isMounted.current) {
        const item = reverse[0];
        const addr = [item.name, item.street, item.city, item.region].filter(Boolean).join(", ");
        setPetData((p) => ({ ...p, address: addr }));
        setLocationFetched(true);
      }
    } catch {
      Alert.alert("Error", "Could not fetch your location. Please try again.");
    } finally {
      if (isMounted.current) setLocationLoading(false);
    }
  }, [locationLoading]);

  const _doSave = useCallback(async () => {
    if (!isMounted.current) return;
    isSubmitting.current = true;
    setLoading(true);
    const { name, category, breed, description, address, image, color, age, phone, displayPhone } = petData;
    try {
      const payload = {
        name: name.trim(),
        category,
        breed: breed.trim(),
        coatcolor: color.trim(),
        age: age ? Number(age) : undefined,
        description: description.trim(),
        address: address.trim(),
        phone: phone.trim(),
        displayPhone,
        ownerId: user?.uid ?? "",
      };
      const res =
        isEditMode && id ? await updatePet(id, payload, image) : await addPet(payload, image);
      if (res.success) {
        navigationLock.current = true;
        InteractionManager.runAfterInteractions(() => {
          if (isMounted.current && router.canGoBack()) router.back();
        });
      } else {
        if (isMounted.current) Alert.alert("Error", res.msg ?? "Operation failed. Please try again.");
      }
    } catch {
      if (isMounted.current) Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      if (isMounted.current) {
        setLoading(false);
        isSubmitting.current = false;
      }
    }
  }, [petData, isEditMode, id, user, addPet, updatePet, router]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit || isSubmitting.current || navigationLock.current || !isMounted.current) return;
    isSubmitting.current = true;
    setLoading(true);
    Keyboard.dismiss();

    let mlFields = mlResultRef.current;

    if (!mlFields && mlPromiseRef.current) {
      setMLDialog({ visible: true, type: "loading" });
      try {
        mlFields = await mlPromiseRef.current;
        if (isMounted.current && mlFields) {
          setPetData((p) => {
            const { category, isOthersAnimal } = resolveCategory(mlFields!.category, mlFields!.breed);
            return {
              ...p,
              category,
              breed: isOthersAnimal
                ? mlFields!.breed
                : mlFields!.breed !== "Unknown"
                ? mlFields!.breed
                : p.breed,
            };
          });
          setMLScores(mlFields.scores);
          setMLStatus("approved");
        }
      } catch (err: unknown) {
        if (isMounted.current) {
          if (err instanceof MLError) {
            const isRejection = (
              [
                "AI_GENERATED",
                "LOW_CONFIDENCE",
                "INVALID_IMAGE",
                "UNSUPPORTED_BREED",
                "BELOW_THRESHOLD",
              ] as MLError["code"][]
            ).includes(err.code);
            if (isRejection) {
              setMLDialog({ visible: true, type: "rejected", reason: err.message, errorCode: err.code });
              setMLStatus("rejected");
            } else {
              setMLDialog({ visible: true, type: "error", message: err.message });
              setMLStatus("error");
            }
          } else {
            setMLDialog({ visible: true, type: "error", message: "An unexpected error occurred." });
          }
        }
        setLoading(false);
        isSubmitting.current = false;
        return;
      }
    }

    if (mlFields) {
      setMLDialog({ visible: true, type: "approved", fields: mlFields });
      setLoading(false);
      isSubmitting.current = false;
      return;
    }

    await _doSave();
  }, [canSubmit, _doSave]);

  const onMLApprove = useCallback(async () => {
    setMLDialog({ visible: false });
    await _doSave();
  }, [_doSave]);

  const onMLRetry = useCallback(() => {
    setMLDialog({ visible: false });
    setModalVisible(true);
  }, []);

  const onMLDismiss = useCallback(() => {
    setMLDialog({ visible: false });
    setLoading(false);
    isSubmitting.current = false;
  }, []);

  const fieldsLocked = mlStatus !== "approved";

  if (!isReady) {
    return (
      <ModalWrapper style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Header
            title={isEditMode ? "Edit Pet" : "Add Pet"}
            leftIcon={<BackButton />}
            style={{ marginBottom: spacingY._10 }}
          />
          <View style={styles.avatarOuter}>
            <View style={styles.avatarContainer}>
              <Image
                style={[
                  styles.avatar,
                  !petData.image && { borderColor: colors.red, borderWidth: 2 },
                  mlStatus === "approved" && { borderColor: colors.green, borderWidth: 2.5 },
                  mlStatus === "rejected" && { borderColor: colors.red, borderWidth: 2.5 },
                ]}
                source={getPetImage(petData.image)}
                contentFit="cover"
                transition={150}
                cachePolicy="memory-disk"
              />
              <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.editIcon}>
                <Pencil size={verticalScale(20)} color={colors.background} weight="duotone" />
              </TouchableOpacity>
              <AvatarOverlay status={mlStatus} />
            </View>
            {mlStatus === "running" && (
              <Typo size={12} color={colors.primary} style={styles.statusHint}>
                Verifying image…
              </Typo>
            )}
            {mlStatus === "rejected" && (
              <Typo size={12} color={colors.red} style={styles.statusHint}>
                Image rejected — please upload a different photo
              </Typo>
            )}
            {mlStatus === "error" && (
              <Typo size={12} color="#F5A623" style={styles.statusHint}>
                Verification unavailable — you can still save
              </Typo>
            )}
          </View>
          {mlStatus === "approved" && mlScores && <TrustScoreBadge scores={mlScores} />}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Typo color={colors.text}>Name</Typo>
              <Input placeholder="Pet name" value={petData.name} onChangeText={handleNameChange} />
            </View>
            <LockedField
              label="Category"
              value={petData.category}
              hint="Detected automatically from photo"
              locked={fieldsLocked && !!petData.image}
            />
            <LockedField
              label="Breed"
              value={petData.breed}
              hint="Detected automatically from photo"
              locked={fieldsLocked && !!petData.image}
            />
            <View style={styles.inputContainer}>
              <Typo color={colors.text}>Color</Typo>
              <Input placeholder="e.g. White" value={petData.color} onChangeText={handleColorChange} />
            </View>
            <View style={styles.inputContainer}>
              <Typo color={colors.text}>Age</Typo>
              <Input
                placeholder="Years"
                keyboardType="numeric"
                value={petData.age}
                onChangeText={handleAgeChange}
              />
            </View>
            <View style={styles.inputContainer}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Typo color={colors.text}>Description</Typo>
                <Typo size={12} color={wordCount < 5 ? colors.red : colors.green}>
                  {wordCount}/5 words min
                </Typo>
              </View>
              <Input
                placeholder="Describe your pet…"
                value={petData.description}
                multiline
                containerStyle={styles.textArea}
                onChangeText={handleDescriptionChange}
              />
            </View>
            <PhoneField
              value={petData.phone}
              displayPhone={petData.displayPhone}
              onChangeText={handlePhoneChange}
              onToggleDisplay={handleDisplayPhoneToggle}
            />
            <View style={styles.inputContainer}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Typo color={colors.text}>Address</Typo>
                <TouchableOpacity
                  onPress={handleFetchLocation}
                  style={[styles.locationBtn, locationFetched && styles.locationBtnActive]}
                  disabled={locationLoading}
                >
                  {locationLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      {locationFetched ? (
                        <CheckCircle size={18} color={colors.green} weight="fill" />
                      ) : (
                        <MapPinLine size={18} color={colors.primary} weight="bold" />
                      )}
                      <Typo
                        size={12}
                        color={locationFetched ? colors.green : colors.primary}
                        fontWeight="600"
                      >
                        {locationFetched ? " Location Set" : " Get Location"}
                      </Typo>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              <Input placeholder="Address auto-filled" value={petData.address} editable={false} />
            </View>
            <View style={styles.footer}>
              <View style={{ flex: 1, gap: 8 }}>
                {!canSubmit && hint !== "" && (
                  <Typo size={12} color={colors.textLight} style={{ textAlign: "center" }}>
                    {hint}
                  </Typo>
                )}
                <Button
                  onPress={onSubmit}
                  loading={loading}
                  disabled={!canSubmit || loading}
                  style={[
                    styles.submitBtn,
                    canSubmit && !loading ? styles.submitBtnReady : styles.submitBtnDisabled,
                  ]}
                >
                  <Typo color={colors.background} fontWeight="700" size={16}>
                    {isEditMode ? "Update Pet" : "Save Pet"}
                  </Typo>
                </Button>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <UploadModal
        modalVisible={modalVisible}
        onBackPress={() => setModalVisible(false)}
        onCameraPress={handleCameraPress}
        onGalleryPress={handleGalleryPress}
        onRemovePress={handleRemovePress}
        isLoading={loading}
      />
      <MLResultDialog state={mlDialog} onApprove={onMLApprove} onRetry={onMLRetry} onDismiss={onMLDismiss} />
    </ModalWrapper>
  );
};

export default memo(PetListModal);

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacingX._20, paddingBottom: spacingY._30 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  avatarOuter: { alignItems: "center", marginTop: spacingY._10, gap: 8 },
  avatarContainer: { position: "relative" },
  form: { gap: spacingY._20, marginTop: spacingY._15 },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: spacingX._20,
    paddingTop: spacingY._15,
    marginBottom: spacingY._20,
  },
  avatar: {
    alignSelf: "center",
    backgroundColor: colors.backgroundDark,
    height: verticalScale(135),
    width: verticalScale(135),
    borderRadius: 200,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  editIcon: {
    position: "absolute",
    bottom: spacingY._5,
    right: spacingY._7,
    borderRadius: 100,
    backgroundColor: colors.green,
    padding: spacingY._7,
    elevation: 4,
  },
  statusHint: { textAlign: "center" },
  inputContainer: { gap: spacingY._10 },
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary + "15",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius._10,
    gap: 4,
  },
  locationBtnActive: { backgroundColor: colors.green + "15", borderColor: colors.green, borderWidth: 1 },
  textArea: { minHeight: verticalScale(80), alignItems: "flex-start", paddingTop: 10 },
  submitBtn: { borderRadius: radius._17 },
  submitBtnReady: {
    backgroundColor: colors.green,
    opacity: 1,
    shadowColor: colors.green,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  submitBtnDisabled: {
    backgroundColor: colors.backgroundDark,
    opacity: 0.45,
    elevation: 0,
  },
});
