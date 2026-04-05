import { StyleSheet, TouchableOpacity } from 'react-native'
import React, { useRef, useCallback, memo } from 'react'
import { BackButtonProps } from '@/types'
import { useRouter } from 'expo-router'
import { CaretLeft } from 'phosphor-react-native'
import { verticalScale } from '@/utils/styling'
import { colors, radius } from '@/constants/themes'
import * as Haptics from 'expo-haptics'

const BackButton = ({
    style,
    iconSize = 24,
}: BackButtonProps) => {
    const router = useRouter();
    const isBusy = useRef(false);

    const handleBack = useCallback(() => {
        if (isBusy.current) return;
        
        isBusy.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        if (router.canGoBack()) {
            router.back();
        }

        setTimeout(() => {
            isBusy.current = false;
        }, 500);
    }, [router]);

    return (
        <TouchableOpacity 
            activeOpacity={0.7}
            onPress={handleBack} 
            style={[styles.button, style]}
        >
            <CaretLeft 
                size={verticalScale(iconSize)} 
                color={colors.white} 
                weight="bold" 
            />
        </TouchableOpacity>
    )
}

export default memo(BackButton);

const styles = StyleSheet.create({
    button: { 
        borderRadius: radius._12,
        borderCurve: "continuous",
        alignSelf: 'flex-start',
        backgroundColor: colors.green,
        padding: 8, 
    },
})