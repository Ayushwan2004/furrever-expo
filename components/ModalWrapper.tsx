import { Platform, StyleSheet, Text, View } from 'react-native'
import React,{memo} from 'react'
import { colors, spacingY } from '@/constants/themes'
import { ModalWrapperProps } from '@/types'

const isIos = Platform.OS == 'ios';
const ModalWrapper = ({
    style,
    children,
    bg = colors.background,
}: ModalWrapperProps) => {
    return (
        <View style={[styles.container, { backgroundColor: bg }, style && style]}>
            {children}
        </View>
    )
}

export default memo(ModalWrapper);

const styles = StyleSheet.create({
    container:{
        flex: 1,
        paddingTop: isIos ? spacingY._15 : 50,
        paddingBottom: isIos ? spacingY._20 : 10,
    },
})