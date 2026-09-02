import React, { useState } from 'react';
import { Alert, StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { supabase } from './supabase';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Relawan'); // Relawan atau Penerima

  // Fungsi Login Supabase
  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Gagal Masuk', error.message);
    else Alert.alert('Sukses', 'Berhasil masuk ke aplikasi!');
    setLoading(false);
  }

  // Fungsi Register Supabase
  async function signUpWithEmail() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: role,
        },
      },
    });

    if (error) Alert.alert('Gagal Daftar', error.message);
    else Alert.alert('Sukses', 'Akun berhasil dibuat! Silakan cek email Anda.');
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.innerContainer}>
        {/* Header Sesuai Desain Figma */}
        <View style={styles.header}>
          <Text style={styles.logoIcon}>🛡️</Text>
          <Text style={styles.title}>{isLogin ? 'TANGGAP KRISIS' : 'Bergabung dengan Jaringan'}</Text>
          <Text style={styles.subtitle}>{isLogin ? 'Akses layanan darurat yang aman.' : 'Daftar untuk memberikan atau menerima bantuan.'}</Text>
        </View>

        {/* Form Register Khusus */}
        {!isLogin && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nama Lengkap</Text>
            <TextInput style={styles.input} onChangeText={setName} value={name} placeholder="Jane Doe" placeholderTextColor="#9ca3af" />
          </View>
        )}

        {/* Input Email & Password */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Alamat Email</Text>
          <TextInput style={styles.input} onChangeText={setEmail} value={email} placeholder="email@jaringan.org" placeholderTextColor="#9ca3af" autoCapitalize="none" keyboardType="email-address" />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Kata Sandi</Text>
          <TextInput style={styles.input} onChangeText={setPassword} value={password} secureTextEntry placeholder="••••••••" placeholderTextColor="#9ca3af" autoCapitalize="none" />
        </View>

        {/* Pilihan Peran Khusus Register */}
        {!isLogin && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Peran Utama</Text>
            <View style={styles.roleContainer}>
              <TouchableOpacity style={[styles.roleButton, role === 'Relawan' && styles.roleActive]} onPress={() => setRole('Relawan')}>
                <Text style={styles.roleText}>Relawan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.roleButton, role === 'Penerima' && styles.roleActive]} onPress={() => setRole('Penerima')}>
                <Text style={styles.roleText}>Penerima</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tombol Aksi Utama */}
        <TouchableOpacity style={styles.mainButton} onPress={isLogin ? signInWithEmail : signUpWithEmail} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isLogin ? 'Masuk ➔' : 'Buat Akun ➔'}</Text>}
        </TouchableOpacity>

        {/* Teks Toggle Bawah */}
        <TouchableOpacity style={styles.toggleButton} onPress={() => setIsLogin(!isLogin)}>
          <Text style={styles.toggleText}>
            {isLogin ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  innerContainer: { flex: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logoIcon: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  inputGroup: { marginBottom: 16 },
  label: { color: '#ffffff', fontSize: 12, marginBottom: 8, textTransform: 'uppercase' },
  input: { backgroundColor: '#1f2937', color: '#ffffff', padding: 14, borderRadius: 8, fontSize: 16 },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  roleButton: { flex: 1, padding: 14, backgroundColor: '#1f2937', borderRadius: 8, marginHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  roleActive: { borderColor: '#dc2626', backgroundColor: '#450a0a' },
  roleText: { color: '#ffffff', fontWeight: 'bold' },
  mainButton: { backgroundColor: '#dc2626', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  toggleButton: { marginTop: 24, alignItems: 'center' },
  toggleText: { color: '#dc2626', fontSize: 14 },
});