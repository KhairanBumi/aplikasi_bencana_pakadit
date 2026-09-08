import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from './supabase';

export default function Auth() {
  const [nama, setNama] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState('');
  
  // State baru untuk mengatur tampilan layar (Login atau Register)
  const [isLoginMode, setIsLoginMode] = useState(true);

  const formatEmail = (inputNama) => {
    const cleanName = inputNama.trim().toLowerCase().replace(/\s+/g, '');
    return `${cleanName}@bencana.local`;
  };

  async function handleProses() {
    if (!nama.trim() || !password.trim()) {
      return setPesan('⚠️ Nama dan sandi harus diisi penuh!');
    }
    
    // Syarat 6 karakter hanya dicek saat sedang mode Daftar
    if (!isLoginMode && password.length < 6) {
      return setPesan('⚠️ Kata sandi minimal 6 karakter!');
    }
    
    setLoading(true);
    setPesan('');
    
    if (isLoginMode) {
      // PROSES LOGIN
      const { error } = await supabase.auth.signInWithPassword({
        email: formatEmail(nama),
        password: password,
      });
      if (error) setPesan('❌ Gagal: Nama atau sandi salah.');
    } else {
      // PROSES DAFTAR (REGISTER)
      const { error } = await supabase.auth.signUp({
        email: formatEmail(nama),
        password: password,
      });
      if (error) {
        if (error.message.includes('already registered')) {
          setPesan('❌ Nama sudah dipakai, gunakan nama lain.');
        } else {
          setPesan(`❌ Gagal: ${error.message}`);
        }
      } else {
        setPesan('✅ Akun berhasil dibuat! Memuat dasbor...');
      }
    }
    
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.title}>
          {isLoginMode ? 'Pintu Masuk Relawan' : 'Daftar Relawan Baru'}
        </Text>
        <Text style={styles.subtitle}>
          {isLoginMode ? 'Gunakan nama yang sudah terdaftar' : 'Buat nama unik yang mudah diingat'}
        </Text>

        <TextInput
          style={styles.input}
          onChangeText={(text) => setNama(text)}
          value={nama}
          placeholder="Masukkan Nama (contoh: budi)"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
        />
        
        <TextInput
          style={styles.input}
          onChangeText={(text) => setPassword(text)}
          value={password}
          secureTextEntry
          placeholder="Kata Sandi (minimal 6 karakter)"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
        />

        {pesan ? <Text style={styles.pesanText}>{pesan}</Text> : null}

        <TouchableOpacity style={styles.btnPrimary} onPress={handleProses} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{isLoginMode ? 'Masuk' : 'Buat Akun'}</Text>
          )}
        </TouchableOpacity>

        {/* Tombol saklar untuk pindah halaman Login/Register */}
        <TouchableOpacity 
          style={styles.btnSwitch} 
          onPress={() => {
            setIsLoginMode(!isLoginMode); // Balikkan mode
            setPesan(''); // Hapus pesan error sebelumnya
            setNama(''); // Kosongkan kolom input
            setPassword('');
          }}
        >
          <Text style={styles.btnSwitchText}>
            {isLoginMode 
              ? 'Belum punya akun? Daftar di sini' 
              : 'Sudah punya akun? Masuk di sini'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: '#1f2937', padding: 24, borderRadius: 12, borderWidth: 1, borderColor: '#374151' },
  title: { color: '#ffffff', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: '#9ca3af', fontSize: 13, textAlign: 'center', marginBottom: 20 },
  input: { backgroundColor: '#111827', color: '#ffffff', padding: 14, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#374151' },
  pesanText: { color: '#fca5a5', fontSize: 13, textAlign: 'center', marginBottom: 16, fontWeight: 'bold' },
  btnPrimary: { backgroundColor: '#dc2626', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  btnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  btnSwitch: { padding: 10, alignItems: 'center' },
  btnSwitchText: { color: '#60a5fa', fontWeight: 'bold', fontSize: 14, textDecorationLine: 'underline' }
});