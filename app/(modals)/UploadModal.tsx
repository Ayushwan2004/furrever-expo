import React from "react";
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { colors, radius, spacingY } from "@/constants/themes";
import Typo from "@/components/Typo";
import * as Icons from "phosphor-react-native";
import { verticalScale } from "@/utils/styling";

interface UploadModalProps {
    modalVisible: boolean;
    onBackPress: () => void;
    onCameraPress: () => void;
    onGalleryPress: () => void;
    onRemovePress: () => void;
    isLoading?: boolean;
}

// Detect small devices (screen height < 680px covers most compact Androids)
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const isSmallDevice = SCREEN_HEIGHT < 680;

const UploadModal: React.FC<UploadModalProps> = ({
    modalVisible,
    onBackPress,
    onCameraPress,
    onGalleryPress,
    onRemovePress,
    isLoading = false,
}) => {
    return (
        <Modal
            animationType="fade"
            visible={modalVisible}
            transparent
            onRequestClose={onBackPress}
        >
            <TouchableOpacity
                style={styles.container}
                onPress={onBackPress}
                activeOpacity={1}
            >
                <View style={styles.modalView}>
                    {isLoading ? (
                        <View style={styles.loadingView}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Typo style={{ marginTop: 10 }}>Uploading...</Typo>
                        </View>
                    ) : (
                        <>
                            <Typo style={styles.title}>Add Photo</Typo>

                            {/* Small device hint */}
                            {isSmallDevice && (
                                <Typo size={11} color={colors.textLight} style={styles.hint}>
                                    After selecting, scroll down to find the crop/confirm button
                                </Typo>
                            )}

                            <View style={styles.decisionRow}>
                                <TouchableOpacity style={styles.optionBtn} onPress={onCameraPress}>
                                    <View style={[styles.iconCircle, { backgroundColor: colors.primary + "15" }]}>
                                        <Icons.Camera
                                            size={verticalScale(isSmallDevice ? 22 : 26)}
                                            color={colors.primary}
                                            weight="fill"
                                        />
                                    </View>
                                    <Typo size={12} fontWeight="600">Camera</Typo>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.optionBtn} onPress={onGalleryPress}>
                                    <View style={[styles.iconCircle, { backgroundColor: colors.green + "15" }]}>
                                        <Icons.Image
                                            size={verticalScale(isSmallDevice ? 22 : 26)}
                                            color={colors.green}
                                            weight="fill"
                                        />
                                    </View>
                                    <Typo size={12} fontWeight="600">Gallery</Typo>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.optionBtn} onPress={onRemovePress}>
                                    <View style={[styles.iconCircle, { backgroundColor: colors.red + "15" }]}>
                                        <Icons.Trash
                                            size={verticalScale(isSmallDevice ? 22 : 26)}
                                            color={colors.red}
                                            weight="fill"
                                        />
                                    </View>
                                    <Typo size={12} fontWeight="600">Remove</Typo>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

export default UploadModal;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalView: {
        backgroundColor: colors.background,
        borderRadius: radius._20,
        padding: spacingY._20,
        width: "85%",
        alignItems: "center",
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    loadingView: {
        padding: spacingY._20,
        alignItems: "center",
    },
    title: {
        marginBottom: spacingY._15,
        fontSize: verticalScale(18),
        fontWeight: "700",
        color: colors.text,
    },
    hint: {
        textAlign: "center",
        marginBottom: spacingY._10,
        marginTop: -spacingY._7,
        paddingHorizontal: 8,
    },
    decisionRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        width: "100%",
        marginTop: spacingY._5,
    },
    optionBtn: {
        alignItems: "center",
        gap: spacingY._7,
    },
    iconCircle: {
        width: verticalScale(isSmallDevice ? 52 : 60),
        height: verticalScale(isSmallDevice ? 52 : 60),
        borderRadius: radius._15,
        justifyContent: "center",
        alignItems: "center",
    },
});