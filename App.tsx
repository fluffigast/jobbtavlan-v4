import React, { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, Text, View, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme, DarkTheme, Theme as NavTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Store, useStore } from "./src/store";
import { SheetHost } from "./src/sheets/Sheets";
import { Idag } from "./src/screens/Idag";
import { Vecka } from "./src/screens/Vecka";
import { Register } from "./src/screens/Register";
import { Inkorg } from "./src/screens/Inkorg";
import { Skydd } from "./src/screens/Skydd";
import { makeTheme, S, F } from "./src/theme";
import { Loading, useReduceMotion } from "./src/ui/kit";
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
  const stilla = useReduceMotion();
  /* Tonar in nedifrån på 160 ms, så den inte bara står där plötsligt.
     Med rörelse avstängd i systemet visas den direkt. */
  const inne = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toast) return;
    inne.setValue(stilla ? 1 : 0);
    Animated.timing(inne, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== "web" }).start();
    const id = setTimeout(clearToast, toast.undo ? 5000 : 2600);
    return () => clearTimeout(id);
  }, [toast, clearToast, inne, stilla]);
  if (!toast) return null;
  return (
    <Animated.View accessibilityLiveRegion="polite" accessibilityRole="alert"
      style={{ position: "absolute", left: S.x4, right: S.x4, bottom: 96, alignItems: "center",
        opacity: inne, transform: [{ translateY: inne.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
      <View style={{
        flexDirection: "row", alignItems: "center", gap: S.x3, maxWidth: 520,
        backgroundColor: t.c.ink, borderRadius: S.r, paddingLeft: S.x4,
        paddingRight: toast.undo ? S.x1 : S.x4, paddingVertical: toast.undo ? 4 : S.x2,
      }}>
        <Text numberOfLines={2} style={{ color: t.c.surface, fontSize: F.sm, flexShrink: 1 }}>{toast.text}</Text>
        {toast.undo ? (
          <Pressable onPress={() => { undo(); }} hitSlop={8}
            style={({ pressed }) => ({ paddingHorizontal: S.x3, paddingVertical: S.x2, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ color: t.c.onInk, fontSize: F.sm, fontWeight: "700" }}>
              Ångra
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
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
        /* Bara luckor idag larmar rött. Olästa sms och öppna skyddspunkter är
           att göra, inte att släppa allt för, och ett rött märke på varje flik
           tränar bort blicken från det enda som brådskar.
           I mörkt läge är crit en ljus röd: svart text, annars läses siffran inte. */
        tabBarBadgeStyle: route.name === "Idag"
          ? { backgroundColor: t.c.crit, color: t.dark ? t.c.bg : "#FFFFFF", fontSize: 11 }
          : { backgroundColor: t.c.muted, color: t.dark ? t.c.bg : "#FFFFFF", fontSize: 11 },
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
  const bas = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme: NavTheme = {
    ...bas,
    colors: { ...bas.colors, background: t.c.bg, card: t.c.surface, border: t.c.line, text: t.c.ink, primary: t.c.accent },
  };
  return (
    <SafeAreaProvider>
      <Store>
        <SheetHost>
          <WebShell>
            <NavigationContainer theme={navTheme}>
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
