import { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../src/supabase';
import { Btn, T, c } from '../src/ui';
import { FadeIn, Press } from '../src/fx';
import { input } from './login';

const VEH = [
  { id: 'scooter', label: 'სკუტერი', emoji: '🛵' },
  { id: 'bike', label: 'ველოსიპედი', emoji: '🚲' },
  { id: 'car', label: 'მანქანა', emoji: '🚗' },
  { id: 'foot', label: 'ფეხით', emoji: '🚶' },
] as const;
const CITIES = ['თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი'];

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pid, setPid] = useState('');
  const [city, setCity] = useState('თბილისი');
  const [vehicle, setVehicle] = useState<(typeof VEH)[number]['id']>('scooter');
  const [plate, setPlate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) { setSignedIn(true); } }); }, []);
  useEffect(() => { Animated.timing(bar, { toValue: step + 1, duration: 350, useNativeDriver: false }).start(); }, [step, bar]);

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const ok0 = signedIn || (emailOk && password.length >= 6);
  const ok1 = name.trim().length >= 3 && phone.replace(/\D/g, '').length >= 9 && pid.replace(/\D/g, '').length === 11;
  const ok2 = vehicle === 'foot' || vehicle === 'bike' || plate.trim().length >= 5;

  async function next() {
    setError('');
    if (step === 0 && !signedIn) {
      setBusy(true);
      const r = await supabase.auth.signUp({ email: email.trim(), password });
      if (r.error && !/already/i.test(r.error.message)) { setBusy(false); const m = r.error.message;
        setError(/password/i.test(m) ? 'პაროლი ძალიან მარტივია' : /rate limit|too many/i.test(m) ? 'ძალიან ბევრი მცდელობაა, სცადე რამდენიმე წუთში' : /disabled/i.test(m) ? 'რეგისტრაცია ჩართული არ არის (Supabase → Auth → Sign In / Providers → Email)' : `რეგისტრაცია ვერ მოხერხდა: ${m}`); return; }
      if (!r.data.session) {
        const s = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (s.error) { setBusy(false); setError(/confirm/i.test(s.error.message) ? 'დაადასტურე ელფოსტა წერილში მოსული ბმულით და შემდეგ შედი' : 'ეს ელფოსტა უკვე გამოიყენება. შედი შენი პაროლით'); return; }
      }
      setBusy(false); setSignedIn(true); setStep(1); return;
    }
    if (step < 2) { setStep(step + 1); return; }
    setBusy(true);
    const r = await supabase.rpc('courier_apply', { p_full_name: name.trim(), p_phone: phone.trim(), p_personal_id: pid.trim(), p_city: city, p_vehicle: vehicle, p_plate: plate.trim() });
    setBusy(false);
    if (r.error) { setError(/already_courier/.test(r.error.message) ? 'შენ უკვე კურიერი ხარ, შედი ანგარიშით' : /could not find the function|schema cache/.test(r.error.message) ? 'ბაზა ჯერ არ არის განახლებული (გაუშვი 0016 SQL მიგრაცია)' : 'განაცხადი ვერ გაიგზავნა. სცადე თავიდან'); return; }
    router.replace('/pending');
  }

  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <Press onPress={onPress} style={{ paddingHorizontal: 16, minHeight: 46, borderRadius: 23, justifyContent: 'center', backgroundColor: on ? c.brand : c.sheet, borderWidth: 1.5, borderColor: on ? c.brand : c.line }}>
      <T size={15} weight="extrabold" color={on ? '#fff' : c.ink}>{label}</T>
    </Press>
  );
  const titles = ['შექმენი ანგარიში', 'პირადი მონაცემები', 'ტრანსპორტი'];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, width: '100%', maxWidth: 480 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => (step > 0 ? setStep(step - 1) : router.canGoBack() ? router.back() : router.replace('/welcome'))} style={{ minHeight: 44, justifyContent: 'center' }}><T size={16} weight="semibold" color={c.muted}>← უკან</T></Pressable>
          <View style={{ gap: 8 }}>
            <T size={13} weight="extrabold" color={c.brandDark}>ნაბიჯი {step + 1} / 3</T>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}>
              <Animated.View style={{ height: 6, borderRadius: 3, backgroundColor: c.brand, width: bar.interpolate({ inputRange: [0, 3], outputRange: ['0%', '100%'] }) }} />
            </View>
          </View>
          <FadeIn key={step} style={{ gap: 12 }}>
            <T size={28} weight="extrabold">{titles[step]}</T>
            {step === 0 ? (signedIn ? <T size={15} color={c.muted}>ანგარიში უკვე გაქვს. გააგრძელე განაცხადის შევსება.</T> : (
              <>
                <T size={15} color={c.muted}>ამ ელფოსტით და პაროლით შეხვალ აპში</T>
                <TextInput style={input} placeholder="ელფოსტა" placeholderTextColor={c.muted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
                <TextInput style={input} placeholder="პაროლი (მინ. 6 სიმბოლო)" placeholderTextColor={c.muted} secureTextEntry value={password} onChangeText={setPassword} />
              </>
            )) : null}
            {step === 1 ? (
              <>
                <TextInput style={input} placeholder="სახელი და გვარი" placeholderTextColor={c.muted} value={name} onChangeText={setName} />
                <TextInput style={input} placeholder="ტელეფონი (5XX XXX XXX)" placeholderTextColor={c.muted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
                <TextInput style={input} placeholder="პირადი ნომერი (11 ციფრი)" placeholderTextColor={c.muted} keyboardType="number-pad" maxLength={11} value={pid} onChangeText={setPid} />
                <T size={14} color={c.muted}>ქალაქი</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{CITIES.map((x) => <Chip key={x} on={city === x} label={x} onPress={() => setCity(x)} />)}</View>
              </>
            ) : null}
            {step === 2 ? (
              <>
                <T size={15} color={c.muted}>რით აპირებ მიტანას?</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {VEH.map((v) => (
                    <Press key={v.id} onPress={() => setVehicle(v.id)} style={{ width: 150, paddingVertical: 18, borderRadius: 18, alignItems: 'center', gap: 6, backgroundColor: vehicle === v.id ? c.brandSoft : c.sheet, borderWidth: 2, borderColor: vehicle === v.id ? c.brand : c.line }}>
                      <T size={30}>{v.emoji}</T><T size={15} weight="extrabold">{v.label}</T>
                    </Press>
                  ))}
                </View>
                {vehicle === 'scooter' || vehicle === 'car' ? <TextInput style={input} placeholder="სახელმწიფო ნომერი (AA-123-AA)" placeholderTextColor={c.muted} autoCapitalize="characters" value={plate} onChangeText={setPlate} /> : null}
                <View style={{ backgroundColor: c.brandSoft, borderRadius: 14, padding: 14 }}><T size={14} color={c.ink}>განაცხადს გადავამოწმებთ. დამტკიცების შემდეგ შეძლებ შეკვეთების მიღებას. დოკუმენტებს (მოწმობა, პირადობა) ცალკე მოგთხოვთ.</T></View>
              </>
            ) : null}
            {error ? <T color={c.red} size={15}>{error}</T> : null}
          </FadeIn>
          <View style={{ flex: 1 }} />
          <Btn title={step === 2 ? 'განაცხადის გაგზავნა' : 'გაგრძელება'} onPress={next} busy={busy} disabled={step === 0 ? !ok0 : step === 1 ? !ok1 : !ok2} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
