import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../src/supabase';
import { Bg, Btn, Icon, T, c, card, type IconName } from '../src/ui';
import { FadeIn, Press } from '../src/fx';
import { input } from './login';

const VEH = [
  { id: 'scooter', label: 'სკუტერი', emoji: '🛵' },
  { id: 'bike', label: 'ველო', emoji: '🚲' },
  { id: 'car', label: 'მანქანა', emoji: '🚗' },
  { id: 'foot', label: 'ფეხით', emoji: '🚶' },
] as const;
const CITIES = ['თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი'];
const DOCS: { ic: IconName; t: string; d: string }[] = [
  { ic: 'id', t: 'პირადობის მოწმობა', d: 'დამტკიცების შემდეგ მოგთხოვთ' },
  { ic: 'card', t: 'მართვის მოწმობა', d: 'სკუტერისა და მანქანისთვის' },
  { ic: 'camera', t: 'სელფი', d: 'სახე მკაფიოდ უნდა ჩანდეს' },
];

function Field({ label, icon, children }: { label: string; icon: IconName; children: React.ReactNode }) {
  return (
    <View>
      <T size={12.5} color={c.muted} style={{ marginLeft: 4, marginBottom: 6 }}>{label}</T>
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        {children}
        <View pointerEvents="none" style={{ position: 'absolute', right: 16 }}><Icon name={icon} size={18} color={c.muted} /></View>
      </View>
    </View>
  );
}

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [pid, setPid] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('თბილისი');
  const [cityOpen, setCityOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vehicle, setVehicle] = useState<(typeof VEH)[number]['id']>('scooter');
  const [plate, setPlate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) setSignedIn(true); }); }, []);

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const ok0 = first.trim().length >= 2 && last.trim().length >= 2 && pid.replace(/\D/g, '').length === 11 && phone.replace(/\D/g, '').length >= 9 && (signedIn || (emailOk && password.length >= 6));
  const needPlate = vehicle === 'scooter' || vehicle === 'car';
  const ok1 = !needPlate || plate.trim().length >= 5;

  async function next() {
    setError('');
    if (step === 0) {
      if (!signedIn) {
        setBusy(true);
        const r = await supabase.auth.signUp({ email: email.trim(), password });
        if (r.error && !/already/i.test(r.error.message)) {
          setBusy(false); const m = r.error.message;
          setError(/password/i.test(m) ? 'პაროლი ძალიან მარტივია' : /rate limit|too many/i.test(m) ? 'ძალიან ბევრი მცდელობაა, სცადე რამდენიმე წუთში' : /disabled/i.test(m) ? 'რეგისტრაცია ჩართული არ არის (Supabase → Auth → Sign In / Providers → Email)' : `რეგისტრაცია ვერ მოხერხდა: ${m}`); return;
        }
        if (!r.data.session) {
          const s = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          if (s.error) { setBusy(false); setError(/confirm/i.test(s.error.message) ? 'დაადასტურე ელფოსტა წერილში მოსული ბმულით და შემდეგ შედი' : 'ეს ელფოსტა უკვე გამოიყენება. შედი შენი პაროლით'); return; }
        }
        setBusy(false); setSignedIn(true);
      }
      setStep(1); return;
    }
    setBusy(true);
    const r = await supabase.rpc('courier_apply', { p_full_name: `${first.trim()} ${last.trim()}`, p_phone: phone.trim(), p_personal_id: pid.trim(), p_city: city, p_vehicle: vehicle, p_plate: plate.trim() });
    setBusy(false);
    if (r.error) { setError(/already_courier/.test(r.error.message) ? 'შენ უკვე კურიერი ხარ, შედი ანგარიშით' : /could not find the function|schema cache/.test(r.error.message) ? 'ბაზა ჯერ არ არის განახლებული (გაუშვი 0016 SQL მიგრაცია)' : `განაცხადი ვერ გაიგზავნა: ${r.error.message}`); return; }
    router.replace('/pending');
  }

  const seg = (i: number) => <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= step ? c.brand : c.line }} />;

  return (
    <Bg>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => (step > 0 ? setStep(step - 1) : router.canGoBack() ? router.back() : router.replace('/welcome'))} style={{ width: 40, height: 40, justifyContent: 'center' }}><T size={30}>‹</T></Pressable>
            <Image source={require('../assets/zyro-logo.png')} style={{ width: 100, height: 46 }} resizeMode="contain" />
            <View style={{ width: 40 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>{[0, 1, 2].map(seg)}</View>
          <FadeIn key={step} style={{ gap: 12 }}>
            <View>
              <T size={11.5} weight="extrabold" color={c.brand} style={{ letterSpacing: 0.6 }}>ნაბიჯი {step + 1} / 3</T>
              <T size={27} weight="extrabold" style={{ marginTop: 4 }}>{step === 0 ? 'პირადი ინფორმაცია' : 'ტრანსპორტი და დოკუმენტები'}</T>
              {step === 0 ? <T size={13.5} color={c.muted} style={{ marginTop: 4 }}>ეს მონაცემები გვჭირდება შენი ვინაობის დასადასტურებლად</T> : null}
            </View>

            {step === 0 ? (
              <>
                <Field label="სახელი" icon="user"><TextInput style={input} placeholder="სახელი" placeholderTextColor={c.muted} value={first} onChangeText={setFirst} /></Field>
                <Field label="გვარი" icon="user"><TextInput style={input} placeholder="გვარი" placeholderTextColor={c.muted} value={last} onChangeText={setLast} /></Field>
                <Field label="პირადი ნომერი" icon="id"><TextInput style={input} placeholder="11 ციფრი" placeholderTextColor={c.muted} keyboardType="number-pad" maxLength={11} value={pid} onChangeText={setPid} /></Field>
                <Field label="ტელეფონი" icon="phone"><TextInput style={input} placeholder="+995 5XX XXX XXX" placeholderTextColor={c.muted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} /></Field>
                <View>
                  <T size={12.5} color={c.muted} style={{ marginLeft: 4, marginBottom: 6 }}>ქალაქი</T>
                  <Pressable onPress={() => setCityOpen(!cityOpen)} style={{ ...input, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><T size={15} weight="semibold">{city}</T><Icon name="chev" size={18} color={c.muted} /></Pressable>
                  {cityOpen ? <FadeIn from={6} style={{ ...card, marginTop: 6, overflow: 'hidden' }}>{CITIES.map((x) => <Pressable key={x} onPress={() => { setCity(x); setCityOpen(false); }} style={{ paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: c.line }}><T size={15} weight={x === city ? 'extrabold' : 'regular'} color={x === city ? c.brand : c.ink}>{x}</T></Pressable>)}</FadeIn> : null}
                </View>
                {!signedIn ? (
                  <>
                    <T size={12.5} color={c.muted} style={{ marginLeft: 4, marginTop: 4 }}>შესვლის მონაცემები</T>
                    <TextInput style={input} placeholder="ელფოსტა" placeholderTextColor={c.muted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
                    <TextInput style={input} placeholder="პაროლი (მინ. 6 სიმბოლო)" placeholderTextColor={c.muted} secureTextEntry value={password} onChangeText={setPassword} />
                  </>
                ) : null}
              </>
            ) : (
              <>
                <T size={12.5} color={c.muted} style={{ marginLeft: 4, marginBottom: -4 }}>რით მიიტან შეკვეთებს?</T>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {VEH.map((v) => (
                    <Press key={v.id} onPress={() => setVehicle(v.id)} style={{ flex: 1, height: 74, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: vehicle === v.id ? 'rgba(11,167,154,0.14)' : c.sheet, borderWidth: 1.5, borderColor: vehicle === v.id ? c.brand : c.line }}>
                      <T size={24}>{v.emoji}</T><T size={12} weight="extrabold" color={vehicle === v.id ? c.brandDark : c.ink}>{v.label}</T>
                    </Press>
                  ))}
                </View>
                {needPlate ? <TextInput style={input} placeholder="სანომრე ნიშანი · AB-123-CD" placeholderTextColor={c.muted} autoCapitalize="characters" value={plate} onChangeText={setPlate} /> : null}
                <T size={12.5} color={c.muted} style={{ marginLeft: 4, marginBottom: -4, marginTop: 4 }}>დოკუმენტები</T>
                {DOCS.map((d, i) => (
                  <View key={d.t} style={{ ...card, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, ...(i === 1 ? { borderStyle: 'dashed', borderColor: 'rgba(11,167,154,0.5)' } : null) }}>
                    <View style={{ width: 48, height: 48, borderRadius: i === 2 ? 24 : 14, backgroundColor: 'rgba(11,167,154,0.14)', alignItems: 'center', justifyContent: 'center' }}><Icon name={d.ic} size={22} color={c.brand} /></View>
                    <View style={{ flex: 1 }}><T size={15} weight="extrabold">{d.t}</T><T size={12} color={c.muted}>{d.d}</T></View>
                    <T size={12.5} weight="extrabold" color={c.muted}>მალე</T>
                  </View>
                ))}
                <View style={{ backgroundColor: 'rgba(11,167,154,0.14)', borderRadius: 14, padding: 12 }}><T size={13} color={c.ink}>დოკუმენტების ატვირთვა მალე დაემატება. ახლა განაცხადს მონაცემებით გავგზავნით და დამტკიცებისას დოკუმენტებს ცალკე მოგთხოვთ.</T></View>
              </>
            )}
            {error ? <T color={c.red} size={15}>{error}</T> : null}
          </FadeIn>
          <View style={{ flex: 1 }} />
          <Btn title={step === 1 ? 'განაცხადის გაგზავნა' : 'გაგრძელება'} arrow onPress={next} busy={busy} disabled={step === 0 ? !ok0 : !ok1} style={{ marginBottom: 6 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Bg>
  );
}
