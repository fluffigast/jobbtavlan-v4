import React, { useEffect } from "react";
import { Platform, Pressable, Text, View } from "react-native";
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
import { WebShell } from "./src/ui/WebShell";
import { secOpen, shortToday, unread } from "./src/domain/logic";

const Tab = createBottomTabNavigator();

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Idag: "today-outline", Vecka: "calendar-outline", Register: "people-outline",
  Inkorg: "chatbox-ellipses-outline", Skydd: "shield-checkmark-outline",
};

/* Pratbubblan längst ned bär också ångra-knappen: den som råkade trycka fel
   ska inte behöva leta reda på vad som ändrades. */
function Toast() {
  const { toast, clearToast, undo } = useStore();
  const t = makeTheme(useColorScheme());
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(clearToast, toast.undo ? 5000 : 2600);
    return () => clearTimeout(id);
  }, [toast, clearToast]);
  if (!toast) return null;
  return (
    <View style={{ position: "absolute", left: S.x4, right: S.x4, bottom: 96, alignItems: "center" }}>
      <View style={{
        flexDirection: "row", alignItems: "center", gap: S.x3, maxWidth: 520,
        backgroundColor: t.c.ink, borderRadius: S.r, paddingLeft: S.x4,
        paddingRight: toast.undo ? S.x1 : S.x4, paddingVertical: toast.undo ? 4 : S.x2,
      }}>
        <Text numberOfLines={2} style={{ color: t.c.surface, fontSize: F.sm, flexShrink: 1 }}>{toast.text}</Text>
        {toast.undo ? (
          <Pressable onPress={() => { undo(); }} hitSlop={8}
            style={({ pressed }) => ({ paddingHorizontal: S.x3, paddingVertical: S.x2, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ color: t.c.accent === "#1B5E96" ? "#9FD0FF" : t.c.accent, fontSize: F.sm, fontWeight: "700" }}>
              Ångra
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Tabs() {
  const { s, ready, roll } = useStore();
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
      {/* Kund- och personregistret är arbetsledarens. En snickare som tappar
          telefonen ska inte tappa firmans kundlista med den. */}
      {roll === "ledare" ? <Tab.Screen name="Register" component={Register} /> : null}
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
          <WebShell>
            <NavigationContainer theme={navTheme as any}>
              <Tabs />
              <Toast />
              <StatusBar style={scheme === "dark" ? "light" : "dark"} />
            </NavigationContainer>
          </WebShell>
        </SheetHost>
      </Store>
    </SafeAreaProvider>
  );
}
