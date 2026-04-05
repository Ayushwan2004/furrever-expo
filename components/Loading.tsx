import { ActivityIndicator, ActivityIndicatorProps, StyleSheet, Text, View } from 'react-native'
import React,{memo} from 'react'
import { colors } from '@/constants/themes'

const Loading = ({
    size = "large",
    color = colors.primary,
}: ActivityIndicatorProps) => {
    return (
        <View style={{flex: 1 , justifyContent: "center", alignItems: "center"}}>
            <ActivityIndicator size={size} color={color} />
        </View>
    )
}

export default memo(Loading);

const styles = StyleSheet.create({})