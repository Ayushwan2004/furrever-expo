import { StyleSheet, TextInput, View } from "react-native";
import React,{memo} from "react";
import { InputProps } from "@/types";
import { colors, radius, spacingX } from "@/constants/themes";
import { verticalScale } from "@/utils/styling";

const Input = ({
  containerStyle,
  inputStyle,
  inputRef,
  icon,
  ...textInputProps 
}: InputProps) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {icon && icon}
      <TextInput
        style={[styles.input, inputStyle]}
        placeholderTextColor={colors.orange}
        ref={inputRef}
        {...textInputProps} 
      />
    </View>
  );
};

export default memo(Input);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    height: verticalScale(64),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: radius._17,
    borderCurve: "continuous",
    paddingHorizontal: spacingX._15,
    gap: spacingX._10,
  },
  input: {
    flex: 1,
    color: colors.primary,
    fontSize: verticalScale(14),
  },
});
