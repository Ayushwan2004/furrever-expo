// utils/imagePicker.ts
// Wraps Expo ImagePicker with a small-device safe crop strategy.
//
// On small devices (height < 680px), allowsEditing + aspect causes the
// native crop UI confirm button to render off-screen. Instead we skip
// native editing and square-crop the image ourselves via ImageManipulator.

import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Dimensions } from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
export const isSmallDevice = SCREEN_HEIGHT < 680;

async function squareCrop(uri: string): Promise<string> {
  // First get image dimensions
  const info = await ImageManipulator.manipulateAsync(uri, [], { format: ImageManipulator.SaveFormat.JPEG });
  // ImageManipulator returns width/height on the result
  const { width, height } = info;
  const size = Math.min(width, height);
  const originX = (width - size) / 2;
  const originY = (height - size) / 2;

  const cropped = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX, originY, width: size, height: size } }],
    { compress: 1.0, format: ImageManipulator.SaveFormat.JPEG },
  );
  return cropped.uri;
}

export async function launchCamera(): Promise<string | null> {
  const result = await ImagePicker.launchCameraAsync({
    // On small devices: skip native crop UI, we crop manually below
    allowsEditing: !isSmallDevice,
    aspect: isSmallDevice ? undefined : [1, 1],
    quality: 1.0,
  });

  if (result.canceled) return null;
  const uri = result.assets[0].uri;
  return isSmallDevice ? squareCrop(uri) : uri;
}

export async function launchGallery(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: !isSmallDevice,
    aspect: isSmallDevice ? undefined : [1, 1],
    quality: 1.0,
  });

  if (result.canceled) return null;
  const uri = result.assets[0].uri;
  return isSmallDevice ? squareCrop(uri) : uri;
}