import React, { useEffect } from "react";
import { Platform, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import { Store, useStore } from "./src/store";
import { SheetHost } from "./src/sheets/Sheets";
import { Idag } from "./src/screens/Idag";
import { Vecka } from "./src/screens/Vecka";
import { Register } from "./src/screens/Register";
import { Inkorg } from "./src/screens/Inkorg";
import { Skydd } from "./src/screens/Skydd";
import { makeTheme, S, F } from "./src/theme";
import { Loading } from "./src/ui/kit";
import { secOpen, shortToday, unread } from "./src/domain/logic";

const Tab = createBottomTabNavigator();

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Idag: "today-outline", Vecka: "calendar-outline", Register: "people-outline",
  Inkorg: "chatbox-ellipses-outline", Skydd: "shield-checkmark-outline",
};

/* Liten pratbubbla längst ned: v3:s toast, flyttad ovanför flikraden. */
function Toast() {
  const { toast, clearToast } = useStore();
  const t = makeTheme(useColorScheme());
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(clearToast, 2600);
    return () => clearTimeout(id);
  }, [toast, clearToast]);
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: S.x4, right: S.x4, bottom: 92, alignItems: "center" }}>
      <Text numberOfLines={2} style={{
        backgroundColor: t.c.ink, color: t.c.surface, fontSize: F.sm,
        paddingHorizontal: S.x4, paddingVertical: S.x2, borderRadius: S.r, overflow: "hidden",
      }}>{toast}</Text>
    </View>
  );
}

function Tabs() {
  const { s, ready } = useStore();
  const scheme = useColorScheme();
  const t = makeTheme(scheme);
  if (!ready) return <Loading />;
  const badges: Record<string, number> = {
    Idag: shortToday(s), Inkorg: unread(s).length + s.incidents.filter(i => !i.done).length, Skydd: secOpen(s),
  };
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: t.c.accent,
        tabBarInactiveTintColor: t.c.muted,
        tabBarStyle: { backgroundColor: t.c.surface, borderTopColor: t.c.line, height: Platform.OS === "ios" ? 88 : 64, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarBadge: badges[route.name] || undefined,
        /* I mörkt läge är crit en ljus röd: svart text, annars läses siffran inte. */
        tabBarBadgeStyle: { backgroundColor: t.c.crit, color: t.dark ? t.c.bg : "#FFFFFF", fontSize: 11 },
        tabBarIcon: ({ color, size }) => <Ionicons name={ICON[route.name]} size={size} color={color} />,
      })}>
      <Tab.Screen name="Idag" component={Idag} />
      <Tab.Screen name="Vecka" component={Vecka} />
      <Tab.Screen name="Register" component={Register} />
      <Tab.Screen name="Inkorg" component={Inkorg} />
      <Tab.Screen name="Skydd" component={Skydd} />
    </Tab.Navigator>
  );
}

export default function App() {
  const scheme = useColorScheme();
  const t = makeTheme(scheme);
  const navTheme = {
    ...(scheme === "dark" ? DarkTheme : DefaultTheme),
    colors: { ...(scheme === "dark" ? DarkTheme : DefaultTheme).colors, background: t.c.bg, card: t.c.surface, border: t.c.line, text: t.c.ink, primary: t.c.accent },
  };
  return (
    <SafeAreaProvider>
      <Store>
        <SheetHost>
          <NavigationContainer theme={navTheme as any}>
            <Tabs />
            <Toast />
            <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          </NavigationContainer>
        </SheetHost>
      </Store>
    </SafeAreaProvider>
  );
}
