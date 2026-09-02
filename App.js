import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, Share, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import Auth from './Auth';

// komponen utama aplikasi
function MainApp({ session }) {
  const [bencana, setBencana] = useState([]);
  const [totalDonasi, setTotalDonasi] = useState(0);
  const [filterPulau, setFilterPulau] = useState('Semua');
  const [pinAdmin, setPinAdmin] = useState('');

  useEffect(() => {
    // mengambil data gempa terbaru dari API BMKG
    fetch('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json')
      .then(res => res.json())
      .then(data => setBencana([data.Infogempa.gempa]))
      .catch(err => console.log('Gagal menarik data BMKG:', err));
      
    // memuat riwayat donasi saat aplikasi pertama kali dibuka
    loadDonasi();
  }, []);

  const loadDonasi = async () => {
    const saved = await AsyncStorage.getItem('totalDonasi');
    if (saved) setTotalDonasi(parseInt(saved));
  };

  const handleDonasi = async (nominal) => {
    const totalBaru = totalDonasi + nominal;
    setTotalDonasi(totalBaru);
    // menyimpan ke local storage agar data tidak hilang saat aplikasi ditutup
    await AsyncStorage.setItem('totalDonasi', totalBaru.toString());
    Alert.alert('Terima Kasih!', `Donasi Rp${nominal.toLocaleString('id-ID')} berhasil dicatat.`);
  };

  const handleResetData = async () => {
    // validasi pin admin, sementara diatur 1234
    if (pinAdmin === '1234') { 
      setTotalDonasi(0);
      await AsyncStorage.removeItem('totalDonasi');
      setPinAdmin('');
      Alert.alert('Sukses', 'Data donasi berhasil di-reset.');
    } else {
      Alert.alert('Ditolak', 'PIN Admin salah!');
    }
  };

  const bagikanInfo = async (gempa) => {
    try {
      // fitur bawaan perangkat untuk membagikan info gempa ke sosmed/WA
      await Share.share({
        message: `🚨 INFO DARURAT: Gempa ${gempa.Magnitude} di ${gempa.Wilayah} pada ${gempa.Tanggal} ${gempa.Jam}. Mari bantu saudara kita melalui Aplikasi Tanggap Krisis!`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // render tampilan untuk masing-masing kartu gempa
  const renderBencana = ({ item }) => {
    // logika filter lokasi
    if (filterPulau !== 'Semua' && !item.Wilayah.includes(filterPulau)) return null;
    
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gempa {item.Magnitude}</Text>
        <Text style={styles.cardSubtitle}>📍 {item.Wilayah}</Text>
        <Text style={styles.cardSubtitle}>🗓 {item.Tanggal} | ⏰ {item.Jam}</Text>
        
        <View style={styles.row}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleDonasi(50000)}>
            <Text style={styles.actionText}>Donasi Rp50rb</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.shareButton]} onPress={() => bagikanInfo(item)}>
            <Text style={styles.shareText}>Bagikan</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Halo, Relawan!</Text>
        {/* menampilkan email pengguna yang sedang aktif */}
        <Text style={styles.emailText}>{session?.user?.email}</Text>
        <Text style={styles.donasiText}>Dana Terkumpul: Rp {totalDonasi.toLocaleString('id-ID')}</Text>
      </View>

      <View style={styles.filterContainer}>
        {['Semua', 'Jawa', 'Sumatera', 'Sulawesi'].map(pulau => (
          <TouchableOpacity key={pulau} onPress={() => setFilterPulau(pulau)} style={[styles.filterBtn, filterPulau === pulau && styles.filterBtnActive]}>
            <Text style={[styles.filterText, filterPulau === pulau && styles.filterTextActive]}>{pulau}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>🚨 Data BMKG Terkini</Text>
      <FlatList
        data={bencana}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderBencana}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.adminContainer}>
        <TextInput 
          style={styles.pinInput} 
          placeholder="PIN Admin" 
          placeholderTextColor="#9ca3af" 
          secureTextEntry 
          keyboardType="numeric" 
          value={pinAdmin} 
          onChangeText={setPinAdmin} 
        />
        <TouchableOpacity style={styles.resetBtn} onPress={handleResetData}>
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Keluar Akun</Text>
      </TouchableOpacity>
    </View>
  );
}

// komponen root - berfungsi sebagai penjaga sesi login
export default function App() {
  const [session, setSession] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // cek sesi awal saat aplikasi mulai dijalankan
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsReady(true);
    });

    // pantau perubahan jika pengguna melakukan proses login atau logout
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  // mencegah layar berkedip saat proses pengecekan sesi berlangsung
  if (!isReady) return <View style={{ flex: 1, backgroundColor: '#121212' }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#121212' }}>
      <StatusBar barStyle="light-content" />
      {/* jika ada sesi pengguna, tampilkan MainApp. Jika kosong, arahkan ke form Auth */}
      {session && session.user ? <MainApp session={session} /> : <Auth />}
    </SafeAreaView>
  );
}

// pengaturan gaya desain (styling)
const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#121212', padding: 20 },
  header: { marginBottom: 16 },
  welcomeText: { color: '#ffffff', fontSize: 24, fontWeight: 'bold' },
  emailText: { color: '#9ca3af', fontSize: 14, marginBottom: 8 },
  donasiText: { color: '#dc2626', fontSize: 16, fontWeight: 'bold' },
  
  filterContainer: { flexDirection: 'row', marginBottom: 16, justifyContent: 'space-between' },
  filterBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#374151' },
  filterBtnActive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  filterText: { color: '#9ca3af', fontSize: 12, fontWeight: 'bold' },
  filterTextActive: { color: '#ffffff' },

  sectionTitle: { color: '#f87171', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  
  card: { backgroundColor: '#1f2937', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#374151' },
  cardTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  cardSubtitle: { color: '#9ca3af', fontSize: 14, marginBottom: 4 },
  
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  actionButton: { flex: 1, backgroundColor: '#dc2626', padding: 10, borderRadius: 6, alignItems: 'center', marginRight: 8 },
  shareButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#9ca3af', marginRight: 0, marginLeft: 8 },
  actionText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  shareText: { color: '#9ca3af', fontWeight: 'bold', fontSize: 14 },
  
  adminContainer: { flexDirection: 'row', marginTop: 10, marginBottom: 16 },
  pinInput: { flex: 1, backgroundColor: '#1f2937', color: '#fff', padding: 10, borderRadius: 6, marginRight: 10 },
  resetBtn: { backgroundColor: '#450a0a', padding: 12, borderRadius: 6, justifyContent: 'center', borderWidth: 1, borderColor: '#dc2626' },
  resetText: { color: '#dc2626', fontWeight: 'bold' },
  
  logoutButton: { padding: 14, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#dc2626', borderRadius: 8, alignItems: 'center' },
  logoutText: { color: '#dc2626', fontWeight: 'bold', fontSize: 14 }
});