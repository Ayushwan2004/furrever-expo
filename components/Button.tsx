import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import React, { useRef, useCallback, memo } from "react";
import * as Haptics from 'expo-haptics';
import { CustomButtonProps } from "@/types";
import { colors, radius } from "@/constants/themes";
import { verticalScale } from "@/utils/styling";
import Loading from "./Loading";

const Button = ({ 
  style, 
  onPress, 
  loading = false, 
  children 
}: CustomButtonProps) => {
  const busyLock = useRef(false);

  const handlePress = useCallback(() => {
    if (loading || busyLock.current || !onPress) return;
    
    busyLock.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    onPress();

    setTimeout(() => {
      busyLock.current = false;
    }, 600);
  }, [loading, onPress]);

  if (loading) {
    return (
      <View style={[styles.button, styles.disabled, style]}>
        <Loading color={colors.white} />
      </View>
    );
  }

  return (
    <TouchableOpacity 
      activeOpacity={0.7} 
      onPress={handlePress} 
      style={[styles.button, style]}
    >
      {typeof children === "string" ? (
        <Text style={styles.buttonText}>{children}</Text>
      ) : (
        children || null 
      )}
    </TouchableOpacity>
  );
};

export default memo(Button);

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.green,
    borderRadius: radius._17,
    borderCurve: "continuous",
    height: verticalScale(52),
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  buttonText: { 
    color: colors.white, 
    fontWeight: "700", 
    fontSize: verticalScale(18), 
  },
  disabled: {
    opacity: 0.6,
  }
});