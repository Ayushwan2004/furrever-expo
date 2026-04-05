import { HeaderProps } from '@/types'
import React, {memo} from 'react'
import { StyleSheet, View } from 'react-native'
import Typo from './Typo'

const Header = ({ title = "", leftIcon, style }: HeaderProps) => {
  return (
    <View style={[styles.container, style]}>
      {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
      {!!title && (
        <Typo
          size={22}
          fontWeight="600"
          style={{
            textAlign: "center",
            width: leftIcon ? "82%" : "100%",
          }}
        >
          {String(title)}
        </Typo>
      )}
    </View>
  );
};

export default memo(Header)

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: "center",
        flexDirection: "row",
    },
    leftIcon: {
        alignSelf: "flex-start",
        

    }
})