import { ThemedAlert, useThemedAlert } from "@/components/ThemedAlert";
import { useTheme } from "@/context/ThemeContext";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface TrustedPerson { id: string; name: string; phone: string; relation: string; canSeeLocation: boolean; }
const RELATIONS = ["Parent","Sibling","Partner","Friend","Colleague","Roommate","Other"];
const ACCENT_COLORS = ["gold","blue","green","purple","red"] as const;
const ACCENT_BGS = ["goldMid","blueDim","greenDim","purpleDim","redDim"] as const;

function PersonCard({ person, index, onRemove, onToggleLocation, C }: { person: TrustedPerson; index: number; onRemove: () => void; onToggleLocation: () => void; C: any; }) {
  const color = C[ACCENT_COLORS[index % ACCENT_COLORS.length]];
  const bg = C[ACCENT_BGS[index % ACCENT_BGS.length]];
  const initials = person.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <View style={[s.personCard, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
      <View style={s.personTop}>
        <View style={[s.personAvatar, { backgroundColor: bg }]}><Text style={[s.personInitials, { color }]}>{initials}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[s.personName, { color: C.textPrimary }]}>{person.name}</Text>
          <Text style={[s.personPhone, { color: C.textMuted }]}>{person.phone}</Text>
          <View style={[s.relationBadge, { backgroundColor: bg, borderColor: color + "55" }]}><Text style={[s.relationTxt, { color }]}>{person.relation}</Text></View>
        </View>
        <TouchableOpacity onPress={onRemove} style={[s.removeBtn, { backgroundColor: C.redDim, borderColor: C.red + "44" }]}>
          <Text style={[s.removeBtnTxt, { color: C.red }]}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={[s.locationRow, { borderTopColor: C.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.locationLabel, { color: C.textPrimary }]}>Can see my location</Text>
          <Text style={[s.locationSub, { color: C.textMuted }]}>During Walk Home & SOS</Text>
        </View>
        <TouchableOpacity onPress={onToggleLocation} style={[s.locationToggle, { backgroundColor: person.canSeeLocation ? C.greenDim : C.bgTertiary, borderColor: person.canSeeLocation ? C.green : C.border }]}>
          <Text style={[s.locationToggleTxt, { color: person.canSeeLocation ? C.green : C.textDim }]}>{person.canSeeLocation ? "ON" : "OFF"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AddPersonForm({ onAdd, onCancel, C, onValidationError }: { onAdd: (p: Omit<TrustedPerson, "id">) => void; onCancel: () => void; C: any; onValidationError: (t: string, m: string) => void; }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [relation, setRelation] = useState("Friend");
  function handleAdd() {
    if (!name.trim() || !phone.trim()) { onValidationError("Missing Info", "Please enter name and phone number."); return; }
    onAdd({ name: name.trim(), phone: phone.trim(), relation, canSeeLocation: true });
  }
  return (
    <View style={[s.formCard, { backgroundColor: C.cardBg, borderColor: C.gold + "55" }]}>
      <Text style={[s.formTitle, { color: C.goldText }]}>Add to Trusted Circle</Text>
      <Text style={[s.formLabel, { color: C.textMuted }]}>NAME</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={C.textDim} style={[s.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.textPrimary }]} />
      <Text style={[s.formLabel, { color: C.textMuted }]}>PHONE</Text>
      <TextInput value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" placeholderTextColor={C.textDim} keyboardType="phone-pad" style={[s.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.textPrimary }]} />
      <Text style={[s.formLabel, { color: C.textMuted }]}>RELATION</Text>
      <View style={s.relationGrid}>
        {RELATIONS.map((r) => (
          <TouchableOpacity key={r} onPress={() => setRelation(r)} style={[s.relationChip, { backgroundColor: relation === r ? C.goldMid : C.bgTertiary, borderColor: relation === r ? C.gold : C.border }]}>
            <Text style={[s.relationChipTxt, { color: relation === r ? C.goldText : C.textMuted }]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.formBtns}>
        <TouchableOpacity onPress={onCancel} style={[s.formBtn, { backgroundColor: C.bgTertiary, borderColor: C.border }]}><Text style={[s.formBtnTxt, { color: C.textMuted }]}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity onPress={handleAdd} style={[s.formBtn, { backgroundColor: C.gold }]}><Text style={[s.formBtnTxt, { color: C.mode === "dark" ? "#0A0A0A" : "#fff" }]}>Add Person</Text></TouchableOpacity>
      </View>
    </View>
  );
}

export default function TrustedCircleScreen() {
  const { theme: C } = useTheme(); const router = useRouter(); const insets = useSafeAreaInsets();
  const scrollRef = useScrollToTop(); const { visible, config, showAlert, hideAlert } = useThemedAlert();
  const [people, setPeople] = useState<TrustedPerson[]>([]); const [showForm, setShowForm] = useState(false);

  useEffect(() => { AsyncStorage.getItem("trusted_circle").then((v) => { if (v) setPeople(JSON.parse(v)); }); }, []);
  async function save(list: TrustedPerson[]) { setPeople(list); await AsyncStorage.setItem("trusted_circle", JSON.stringify(list)); }
  function handleAdd(p: Omit<TrustedPerson, "id">) { save([...people, { ...p, id: Date.now().toString() }]); setShowForm(false); }
  function handleRemove(id: string) {
    showAlert({ title: "Remove Person?", message: "They will be removed from your trusted circle.",
      buttons: [{ label: "Cancel", onPress: () => {} }, { label: "Remove", destructive: true, onPress: () => save(people.filter((p) => p.id !== id)) }] });
  }
  function handleToggleLocation(id: string) { save(people.map((p) => p.id === id ? { ...p, canSeeLocation: !p.canSeeLocation } : p)); }
  function handleValidationError(title: string, message: string) { showAlert({ title, message, buttons: [{ label: "OK", onPress: () => {}, primary: true }] }); }

  return (
    <View style={[s.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />
      <View style={[s.topNav, { borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}><Text style={[s.backBtn, { color: C.gold }]}>←</Text></TouchableOpacity>
        <Text style={[s.navTitle, { color: C.textPrimary }]}>Trusted Circle</Text>
        <TouchableOpacity onPress={() => setShowForm(true)} disabled={showForm || people.length >= 10} hitSlop={12}>
          <Text style={[s.addBtn, { color: showForm || people.length >= 10 ? C.textDim : C.gold }]}>Add</Text>
        </TouchableOpacity>
      </View>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}>
        <View style={[s.heroCard, { backgroundColor: C.goldMid, borderColor: C.gold + "44" }]}>
          <Text style={s.heroEmoji}>🤝</Text>
          <Text style={[s.heroTitle, { color: C.goldText }]}>Your Trusted Circle</Text>
          <Text style={[s.heroBody, { color: C.textSecondary }]}>People who can see your location during active safety modes. Up to 10 people.</Text>
        </View>
        {showForm && <AddPersonForm onAdd={handleAdd} onCancel={() => setShowForm(false)} C={C} onValidationError={handleValidationError} />}
        {people.length > 0 ? (
          <View style={s.peopleList}>
            {people.map((person, i) => <PersonCard key={person.id} person={person} index={i} onRemove={() => handleRemove(person.id)} onToggleLocation={() => handleToggleLocation(person.id)} C={C} />)}
          </View>
        ) : !showForm && (
          <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>👥</Text>
            <Text style={[s.emptyTitle, { color: C.textPrimary }]}>No one added yet</Text>
            <Text style={[s.emptySub, { color: C.textMuted }]}>Add trusted people who can see your location during Walk Home and SOS events.</Text>
            <TouchableOpacity onPress={() => setShowForm(true)} style={[s.emptyBtn, { backgroundColor: C.gold }]}>
              <Text style={[s.emptyBtnTxt, { color: C.mode === "dark" ? "#0A0A0A" : "#fff" }]}>+ Add First Person</Text>
            </TouchableOpacity>
          </View>
        )}
        {people.length > 0 && (
          <View style={[s.infoNote, { backgroundColor: C.bgTertiary, borderColor: C.border }]}>
            <Text style={[s.infoNoteTxt, { color: C.textMuted }]}>💡 Trusted Circle members can track your location during active safety modes. Emergency Contacts receive SOS alerts.</Text>
          </View>
        )}
      </ScrollView>
      <ThemedAlert visible={visible} title={config.title} message={config.message} buttons={config.buttons} C={C} onClose={hideAlert} />
    </View>
  );
}

const s = StyleSheet.create({
  root:{flex:1}, topNav:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:14,borderBottomWidth:1},
  backBtn:{fontSize:22,fontWeight:"700",width:36}, navTitle:{fontSize:15,fontWeight:"900",letterSpacing:0.5}, addBtn:{fontSize:14,fontWeight:"800"},
  scrollContent:{padding:16,gap:12}, heroCard:{borderRadius:18,borderWidth:1,padding:20,alignItems:"center",gap:8},
  heroEmoji:{fontSize:36}, heroTitle:{fontSize:17,fontWeight:"900",textAlign:"center"}, heroBody:{fontSize:13,fontWeight:"500",textAlign:"center",lineHeight:19},
  formCard:{borderRadius:16,borderWidth:1,padding:18,gap:10}, formTitle:{fontSize:14,fontWeight:"900",marginBottom:4},
  formLabel:{fontSize:9,fontWeight:"800",letterSpacing:1.5,marginBottom:2}, input:{borderWidth:1,borderRadius:10,paddingHorizontal:14,paddingVertical:11,fontSize:13,fontWeight:"600",marginBottom:4},
  relationGrid:{flexDirection:"row",flexWrap:"wrap",gap:8}, relationChip:{paddingHorizontal:12,paddingVertical:7,borderRadius:18,borderWidth:1},
  relationChipTxt:{fontSize:11,fontWeight:"700"}, formBtns:{flexDirection:"row",gap:10,marginTop:8},
  formBtn:{flex:1,paddingVertical:12,borderRadius:12,alignItems:"center",borderWidth:1}, formBtnTxt:{fontSize:13,fontWeight:"800"},
  peopleList:{gap:10}, personCard:{borderRadius:14,borderWidth:1,overflow:"hidden"},
  personTop:{flexDirection:"row",alignItems:"center",gap:12,padding:14}, personAvatar:{width:46,height:46,borderRadius:23,alignItems:"center",justifyContent:"center"},
  personInitials:{fontSize:16,fontWeight:"900"}, personName:{fontSize:14,fontWeight:"800",marginBottom:2}, personPhone:{fontSize:11,fontWeight:"500",marginBottom:5},
  relationBadge:{alignSelf:"flex-start",paddingHorizontal:9,paddingVertical:3,borderRadius:8,borderWidth:1}, relationTxt:{fontSize:9,fontWeight:"800"},
  removeBtn:{width:30,height:30,borderRadius:15,alignItems:"center",justifyContent:"center",borderWidth:1}, removeBtnTxt:{fontSize:12,fontWeight:"900"},
  locationRow:{flexDirection:"row",alignItems:"center",paddingHorizontal:14,paddingVertical:12,borderTopWidth:1,gap:12},
  locationLabel:{fontSize:12,fontWeight:"700",marginBottom:2}, locationSub:{fontSize:10,fontWeight:"500"},
  locationToggle:{paddingHorizontal:14,paddingVertical:7,borderRadius:12,borderWidth:1}, locationToggleTxt:{fontSize:11,fontWeight:"900",letterSpacing:0.5},
  emptyState:{alignItems:"center",paddingVertical:40,gap:10}, emptyEmoji:{fontSize:48}, emptyTitle:{fontSize:17,fontWeight:"900"},
  emptySub:{fontSize:13,fontWeight:"500",textAlign:"center",lineHeight:19,paddingHorizontal:20}, emptyBtn:{marginTop:8,paddingHorizontal:28,paddingVertical:13,borderRadius:14},
  emptyBtnTxt:{fontSize:14,fontWeight:"900"}, infoNote:{padding:14,borderRadius:12,borderWidth:1}, infoNoteTxt:{fontSize:11,fontWeight:"500",lineHeight:17},
});