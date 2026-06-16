import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export default function SignupScreen({ navigation }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const getPasswordStrength = () => {
    if (password.length === 0) return null;
    if (password.length < 6) return { label: 'Weak', color: '#FF3B30', width: '30%' };
    if (password.length < 10) return { label: 'Fair', color: '#FF9500', width: '60%' };
    return { label: 'Strong', color: '#34C759', width: '100%' };
  };

  const handleSignup = async () => {
    if (!displayName.trim() || !email.trim() || !password || !confirmPassword) {
      shake();
      Alert.alert('Missing Info', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      shake();
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      shake();
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: displayName.trim() });
      // Save user profile to Firestore
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        displayName: displayName.trim(),
        email: email.trim(),
        createdAt: new Date().toISOString(),
        avatar: null,
        bio: '',
        coins: 1000,
        diamonds: 0,
      });
      // Navigation handled by AppNavigator auth state listener
    } catch (error) {
      shake();
      let msg = 'Signup failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') msg = 'This email is already registered.';
      else if (error.code === 'auth/invalid-email') msg = 'Invalid email address.';
      else if (error.code === 'auth/weak-password') msg = 'Password is too weak.';
      Alert.alert('Signup Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Background blobs */}
        <View style={styles.blob1} />
        <View style={styles.blob2} />

        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="mic" size={38} color="#fff" />
          </View>
          <Text style={styles.appName}>Join UChat</Text>
          <Text style={styles.tagline}>Start connecting with voice rooms</Text>
        </View>

        {/* Card */}
        <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
          <Text style={styles.cardTitle}>Create Account</Text>
          <Text style={styles.cardSub}>It's free and only takes a minute</Text>

          {/* Display Name */}
          <View style={[styles.inputWrap, nameFocused && styles.inputWrapFocused]}>
            <Ionicons name="person-outline" size={18} color={nameFocused ? '#FF3B8B' : '#666'} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Display name"
              placeholderTextColor="#555"
              value={displayName}
              onChangeText={setDisplayName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
            />
          </View>

          {/* Email */}
          <View style={[styles.inputWrap, emailFocused && styles.inputWrapFocused]}>
            <Ionicons name="mail-outline" size={18} color={emailFocused ? '#FF3B8B' : '#666'} style={styles.inputIcon} />
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

          {/* Password */}
          <View style={[styles.inputWrap, passFocused && styles.inputWrapFocused]}>
            <Ionicons name="lock-closed-outline" size={18} color={passFocused ? '#FF3B8B' : '#666'} style={styles.inputIcon} />
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
          </View>

          {/* Password Strength */}
          {strength && (
            <View style={styles.strengthRow}>
              <View style={styles.strengthBar}>
                <View style={[styles.strengthFill, { width: strength.width, backgroundColor: strength.color }]} />
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
            </View>
          )}

          {/* Confirm Password */}
          <View style={[styles.inputWrap, confirmFocused && styles.inputWrapFocused, { marginTop: 8 }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={confirmFocused ? '#FF3B8B' : '#666'} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor="#555"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              onFocus={() => setConfirmFocused(true)}
              onBlur={() => setConfirmFocused(false)}
            />
            {confirmPassword.length > 0 && (
              <Ionicons
                name={password === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={password === confirmPassword ? '#34C759' : '#FF3B30'}
              />
            )}
          </View>

          {/* Terms */}
          <Text style={styles.terms}>
            By signing up, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text>
            {' & '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>

          {/* Signup Button */}
          <TouchableOpacity style={styles.signupBtn} onPress={handleSignup} disabled={loading} activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.signupBtnText}>Create Account</Text>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Login Link */}
        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  blob1: { position: 'absolute', top: -60, right: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(99,102,241,0.2)' },
  blob2: { position: 'absolute', bottom: -80, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,59,139,0.15)' },
  backBtn: { position: 'absolute', top: 60, left: 24, zIndex: 10, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  logoCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16 },
  appName: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  tagline: { fontSize: 14, color: '#888', marginTop: 4 },
  card: { width: '100%', maxWidth: 400, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 24, padding: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  cardSub: { fontSize: 14, color: '#888', marginBottom: 24 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 14, paddingHorizontal: 14, height: 52 },
  inputWrapFocused: { borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.1)' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#fff', fontSize: 15, height: '100%' },
  eyeBtn: { padding: 4 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  strengthBar: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginRight: 10, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '600', width: 46, textAlign: 'right' },
  terms: { color: '#555', fontSize: 12, marginVertical: 16, textAlign: 'center', lineHeight: 18 },
  termsLink: { color: '#6366F1', fontWeight: '600' },
  signupBtn: { flexDirection: 'row', backgroundColor: '#6366F1', borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
  signupBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginRow: { flexDirection: 'row', marginTop: 28 },
  loginText: { color: '#666', fontSize: 14 },
  loginLink: { color: '#6366F1', fontSize: 14, fontWeight: '700' },
});
