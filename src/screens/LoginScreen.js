import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Alert, Dimensions
} from 'react-native';
import Animated, {
  FadeInDown, FadeInUp, ZoomIn, FadeIn,
  useSharedValue, useAnimatedStyle,
  withSpring, withSequence, withTiming
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  signInWithEmailAndPassword,
  signInAnonymously,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const { height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused]   = useState(false);
  const [mode, setMode]                 = useState('login'); // 'login' | 'forgot'
  const [statusMsg, setStatusMsg]       = useState(null); // { text, type: 'success'|'error' }

  const shakeX      = useSharedValue(0);
  const cardScale   = useSharedValue(0.93);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    cardScale.value   = withSpring(1, { damping: 14, stiffness: 100 });
    cardOpacity.value = withTiming(1, { duration: 600 });
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const shake = () => {
    shakeX.value = withSequence(
      withTiming(12, { duration: 55 }), withTiming(-12, { duration: 55 }),
      withTiming(8,  { duration: 55 }), withTiming(-8,  { duration: 55 }),
      withTiming(0,  { duration: 55 }),
    );
  };

  const showStatus = (text, type = 'error') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 5000);
  };

  /* ── Login ── */
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      shake(); showStatus('Please enter your email and password.'); return;
    }
    setLoading(true);
    setStatusMsg(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      shake();
      let msg = 'Login failed. Please try again.';
      if (error.code === 'auth/user-not-found')        msg = 'No account found with this email.';
      if (error.code === 'auth/wrong-password')        msg = 'Incorrect password.';
      if (error.code === 'auth/invalid-credential')    msg = 'Incorrect email or password.';
      if (error.code === 'auth/invalid-email')         msg = 'Invalid email address.';
      if (error.code === 'auth/too-many-requests')     msg = 'Too many attempts. Try again later.';
      showStatus(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ── Guest ── */
  const handleGuestLogin = async () => {
    setGuestLoading(true);
    setStatusMsg(null);
    try {
      const cred = await signInAnonymously(auth);
      // Save a guest profile so the app doesn't crash on profile load
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        displayName: 'Guest',
        email: '',
        coins: 500,
        diamonds: 0,
        avatar: '👻',
        bio: 'Browsing as guest',
        isGuest: true,
        createdAt: Date.now(),
      }, { merge: true });
    } catch (error) {
      let msg = 'Guest login failed. Please try again.';
      if (error.code === 'auth/operation-not-allowed')
        msg = 'Guest login is not enabled. Please sign up instead.';
      showStatus(msg, 'error');
    } finally {
      setGuestLoading(false);
    }
  };

  /* ── Forgot Password ── */
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      shake(); showStatus('Enter your email address above first.'); return;
    }
    setLoading(true);
    setStatusMsg(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showStatus(`✅ Reset email sent to ${email.trim()}! Check your inbox.`, 'success');
    } catch (error) {
      let msg = 'Failed to send reset email.';
      if (error.code === 'auth/user-not-found')  msg = 'No account found with this email.';
      if (error.code === 'auth/invalid-email')   msg = 'Invalid email address.';
      showStatus(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setStatusMsg(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Background blobs */}
      <Animated.View entering={FadeInUp.duration(1000)}   style={styles.blob1} />
      <Animated.View entering={FadeInDown.duration(1000)} style={styles.blob2} />
      <View style={styles.blob3} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <Animated.View entering={FadeInDown.duration(700).delay(100)} style={styles.header}>
          <Animated.View entering={ZoomIn.duration(600).delay(200)} style={styles.logoCircle}>
            <Ionicons name="mic" size={38} color="#fff" />
          </Animated.View>
          <Text style={styles.appName}>UChat</Text>
          <Text style={styles.tagline}>Join voice rooms. Meet people.</Text>
        </Animated.View>

        {/* Card */}
        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.cardTitle}>
            {mode === 'forgot' ? '🔑 Reset Password' : 'Welcome back 👋'}
          </Text>
          <Text style={styles.cardSub}>
            {mode === 'forgot'
              ? 'We\'ll send a reset link to your email'
              : 'Sign in to continue'}
          </Text>

          {/* Inline status message */}
          {statusMsg && (
            <Animated.View
              entering={FadeIn.duration(300)}
              style={[styles.statusBox,
                statusMsg.type === 'success' ? styles.statusSuccess : styles.statusError]}
            >
              <Ionicons
                name={statusMsg.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={statusMsg.type === 'success' ? '#34C759' : '#FF3B30'}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.statusText,
                { color: statusMsg.type === 'success' ? '#34C759' : '#FF5555' }]}>
                {statusMsg.text}
              </Text>
            </Animated.View>
          )}

          {/* Email */}
          <View style={[styles.inputWrap, emailFocused && styles.inputFocused]}>
            <Ionicons name="mail-outline" size={18}
              color={emailFocused ? '#FF3B8B' : '#666'} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#555"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          {/* Password — hidden in forgot mode */}
          {mode === 'login' && (
            <Animated.View entering={FadeInDown.duration(300)}
              style={[styles.inputWrap, passFocused && styles.inputFocused]}>
              <Ionicons name="lock-closed-outline" size={18}
                color={passFocused ? '#FF3B8B' : '#666'} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#555"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#666" />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Forgot link */}
          {mode === 'login' && (
            <TouchableOpacity style={styles.forgotBtn} onPress={() => switchMode('forgot')}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {/* Action Button */}
          {mode === 'login' ? (
            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <><Text style={styles.primaryBtnText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} /></>}
            </TouchableOpacity>
          ) : (
            <Animated.View entering={FadeInDown.duration(400)}>
              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                onPress={handleForgotPassword}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <><Ionicons name="send-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.primaryBtnText}>Send Reset Email</Text></>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => switchMode('login')}>
                <Ionicons name="arrow-back-outline" size={16} color="#aaa" style={{ marginRight: 6 }} />
                <Text style={styles.backBtnText}>Back to Login</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Divider + Guest */}
          {mode === 'login' && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.guestBtn}
                onPress={handleGuestLogin}
                disabled={guestLoading}
                activeOpacity={0.8}
              >
                {guestLoading
                  ? <ActivityIndicator color="#aaa" size="small" />
                  : <><Ionicons name="person-outline" size={16} color="#aaa" style={{ marginRight: 8 }} />
                      <Text style={styles.guestBtnText}>Continue as Guest</Text></>}
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        {/* Signup link */}
        <Animated.View entering={FadeInUp.duration(600).delay(500)} style={styles.signupRow}>
          <Text style={styles.signupText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.signupLink}>Create one</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F' },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },

  blob1: { position: 'absolute', top: -100, left: -80, width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(255,59,139,0.18)' },
  blob2: { position: 'absolute', bottom: -80, right: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(99,102,241,0.16)' },
  blob3: { position: 'absolute', top: height * 0.4, left: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(0,229,255,0.07)' },

  header: { alignItems: 'center', marginBottom: 36 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF3B8B',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: '#FF3B8B', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6, shadowRadius: 20, elevation: 15,
  },
  appName: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  tagline: { fontSize: 14, color: '#777', marginTop: 5 },

  card: {
    width: '100%', maxWidth: 420,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 28, padding: 28,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4, shadowRadius: 30, elevation: 20,
  },
  cardTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
  cardSub: { fontSize: 14, color: '#888', marginBottom: 20 },

  // Status message
  statusBox: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1,
  },
  statusSuccess: { backgroundColor: 'rgba(52,199,89,0.1)', borderColor: 'rgba(52,199,89,0.4)' },
  statusError:   { backgroundColor: 'rgba(255,59,48,0.1)',  borderColor: 'rgba(255,59,48,0.4)' },
  statusText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  // Inputs
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 14, paddingHorizontal: 14, height: 54,
  },
  inputFocused: { borderColor: '#FF3B8B', backgroundColor: 'rgba(255,59,139,0.08)' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#fff', fontSize: 15, height: '100%' },
  eyeBtn: { padding: 6 },

  forgotBtn: { alignSelf: 'flex-end', marginBottom: 22, paddingVertical: 4 },
  forgotText: { color: '#FF3B8B', fontSize: 13, fontWeight: '600' },

  primaryBtn: {
    flexDirection: 'row', backgroundColor: '#FF3B8B',
    borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF3B8B', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  backBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingVertical: 8 },
  backBtnText: { color: '#aaa', fontSize: 14 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: '#555', marginHorizontal: 12, fontSize: 13 },

  guestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14, height: 52,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  guestBtnText: { color: '#aaa', fontSize: 15, fontWeight: '600' },

  signupRow: { flexDirection: 'row', marginTop: 30, alignItems: 'center' },
  signupText: { color: '#666', fontSize: 14 },
  signupLink: { color: '#FF3B8B', fontSize: 14, fontWeight: '800' },
});
