import React from "react";
import { Tabs } from "expo-router";
import CustomTabs from "@/components/CustomTabs";
import NotificationBell from '@/components/NotificationBell';


export default function _layout() {
  return (
    <Tabs tabBar={(props) => <CustomTabs {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" /> 
      <Tabs.Screen name="favourite" /> 
      <Tabs.Screen name="inbox" /> 
      <Tabs.Screen name="profile" /> 
    </Tabs >
  );
};