import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Alert, Dimensions
} from 'react-native';
import Animated, {
  FadeInDown, FadeInUp, ZoomIn,
  useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const { height } = Dimensions.get('window');

export default function SignupScreen({ navigation }) {
  const [displayName, setDisplayName]     = useState('');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [loading, setLoading]             = useState(false);
  const [focused, setFocused]             = useState('');

  const shakeX     = useSharedValue(0);
  const cardScale  = useSharedValue(0.92);
  const cardOpacity= useSharedValue(0);

  useEffect(() => {
    cardScale.value  = withSpring(1, { damping: 14, stiffness: 100 });
    cardOpacity.value= withTiming(1, { duration: 600 });
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const shake = () => {
    shakeX.value = withSequence(
      withTiming(10, { duration: 60 }), withTiming(-10, { duration: 60 }),
      withTiming(10, { duration: 60 }), withTiming(-10, { duration: 60 }),
      withTiming(0,  { duration: 60 }),
    );
  };

  const getPasswordStrength = () => {
    if (password.length === 0) return null;
    if (password.length < 6)  return { label: 'Weak',   color: '#FF3B30', pct: '30%' };
    if (password.length < 10) return { label: 'Fair',   color: '#FF9500', pct: '60%' };
    return                           { label: 'Strong', color: '#34C759', pct: '100%' };
  };

  const handleSignup = async () => {
    if (!displayName.trim() || !email.trim() || !password || !confirmPassword) {
      shake(); Alert.alert('Missing Info', 'Please fill in all fields.'); return;
    }
    if (password !== confirmPassword) {
      shake(); Alert.alert('Password Mismatch', 'Passwords do not match.'); return;
    }
    if (password.length < 6) {
      shake(); Alert.alert('Weak Password', 'Password must be at least 6 characters.'); return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: displayName.trim() });
      
      // Magic Admin Feature: If email starts with 'admin', they become an admin
      const isAutoAdmin = email.trim().toLowerCase().startsWith('admin');
      
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        displayName: displayName.trim(),
        email: email.trim(),
        coins: 5000,
        diamonds: 0,
        beans: 0,
        role: isAutoAdmin ? 'admin' : 'user',
        createdAt: Date.now(),
        isGuest: false,
      });
    } catch (error) {
      shake();
      let msg = 'Signup failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') msg = 'An account already exists with this email.';
      else if (error.code === 'auth/invalid-email')   msg = 'Invalid email address.';
      else if (error.code === 'auth/weak-password')   msg = 'Password is too weak.';
      Alert.alert('Signup Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength();
  const isFocused = (name) => focused === name;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Background blobs */}
      <Animated.View entering={FadeInUp.duration(1000)} style={styles.blob1} />
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
            <Ionicons name="mic" size={36} color="#fff" />
          </Animated.View>
          <Text style={styles.appName}>UChat</Text>
          <Text style={styles.tagline}>Create your account</Text>
        </Animated.View>

        {/* Card */}
        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.cardTitle}>Get started 🚀</Text>
          <Text style={styles.cardSub}>Join thousands of voice rooms</Text>

          {/* Name */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)}>
            <InputField
              icon="person-outline"
              placeholder="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              focused={isFocused('name')}
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused('')}
            />
          </Animated.View>

          {/* Email */}
          <Animated.View entering={FadeInDown.duration(400).delay(180)}>
            <InputField
              icon="mail-outline"
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              focused={isFocused('email')}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused('')}
            />
          </Animated.View>

          {/* Password */}
          <Animated.View entering={FadeInDown.duration(400).delay(260)}>
            <InputField
              icon="lock-closed-outline"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secure={!showPassword}
              focused={isFocused('pass')}
              onFocus={() => setFocused('pass')}
              onBlur={() => setFocused('')}
              rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightIcon={() => setShowPassword(!showPassword)}
            />
          </Animated.View>

          {/* Password strength bar */}
          {strength && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.strengthContainer}>
              <View style={styles.strengthBar}>
                <View style={[styles.strengthFill, { width: strength.pct, backgroundColor: strength.color }]} />
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
            </Animated.View>
          )}

          {/* Confirm Password */}
          <Animated.View entering={FadeInDown.duration(400).delay(340)}>
            <InputField
              icon="shield-checkmark-outline"
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secure={!showConfirm}
              focused={isFocused('confirm')}
              onFocus={() => setFocused('confirm')}
              onBlur={() => setFocused('')}
              rightIcon={showConfirm ? 'eye-off-outline' : 'eye-outline'}
              onRightIcon={() => setShowConfirm(!showConfirm)}
              matchOk={confirmPassword.length > 0 && confirmPassword === password}
            />
          </Animated.View>

          {/* Sign Up Button */}
          <Animated.View entering={FadeInDown.duration(400).delay(420)}>
            <TouchableOpacity
              style={styles.signupBtn}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.signupBtnText}>Create Account</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* Login link */}
        <Animated.View entering={FadeInUp.duration(600).delay(600)} style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Reusable Input Field
function InputField({ icon, placeholder, value, onChangeText, focused, onFocus, onBlur,
  secure, rightIcon, onRightIcon, keyboardType, autoCapitalize, matchOk }) {
  return (
    <View style={[styles.inputWrap, focused && styles.inputWrapFocused, matchOk && styles.inputWrapValid]}>
      <Ionicons name={icon} size={18} color={focused ? '#FF3B8B' : '#666'} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#555"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || 'words'}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {rightIcon && (
        <TouchableOpacity onPress={onRightIcon} style={styles.eyeBtn}>
          <Ionicons name={rightIcon} size={18} color="#666" />
        </TouchableOpacity>
      )}
      {matchOk && (
        <Ionicons name="checkmark-circle" size={20} color="#34C759" style={{ marginLeft: 4 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F' },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 50, paddingHorizontal: 24 },

  blob1: { position: 'absolute', top: -100, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(99,102,241,0.2)' },
  blob2: { position: 'absolute', bottom: -80, left: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,59,139,0.18)' },
  blob3: { position: 'absolute', top: height * 0.5, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(0,229,255,0.07)' },

  header: { alignItems: 'center', marginBottom: 30 },
  logoCircle: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6, shadowRadius: 20, elevation: 15,
  },
  appName: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  tagline: { fontSize: 14, color: '#777', marginTop: 5 },

  card: {
    width: '100%', maxWidth: 420,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 28, padding: 26,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4, shadowRadius: 30, elevation: 20,
  },
  cardTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
  cardSub: { fontSize: 14, color: '#888', marginBottom: 24 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12, paddingHorizontal: 14, height: 54,
  },
  inputWrapFocused: { borderColor: '#FF3B8B', backgroundColor: 'rgba(255,59,139,0.08)' },
  inputWrapValid: { borderColor: '#34C759', backgroundColor: 'rgba(52,199,89,0.06)' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#fff', fontSize: 15, height: '100%' },
  eyeBtn: { padding: 6 },

  strengthContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: -4 },
  strengthBar: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginRight: 10, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '700', width: 50 },

  signupBtn: {
    flexDirection: 'row', backgroundColor: '#6366F1',
    borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
  },
  signupBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  loginRow: { flexDirection: 'row', marginTop: 28, alignItems: 'center' },
  loginText: { color: '#666', fontSize: 14 },
  loginLink: { color: '#FF3B8B', fontSize: 14, fontWeight: '800' },
});
