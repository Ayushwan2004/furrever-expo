import { colors } from '@/constants/themes'
import { ScreenWrapperProps } from '@/types'
import React,{memo} from 'react'
import { Platform, StatusBar, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const ScreenWrapper = ({ style, children }: ScreenWrapperProps) => {
    // * This hook gets the EXACT pixel height of the notch/status bar
    const insets = useSafeAreaInsets();

    // Account for Android StatusBar vs iOS Notch
    const paddingTop = Platform.OS === 'ios' 
        ? insets.top 
        : Math.max(insets.top, 15); // Gives a minimum breathing room on Android

    return (
        <View style={[{
            paddingTop,
            flex: 1, 
            backgroundColor: colors.background
        }, style]}>
            {/* barStyle "dark-content" usually looks better on light backgrounds */}
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            {children}
        </View>
    )
}

export default memo(ScreenWrapper)