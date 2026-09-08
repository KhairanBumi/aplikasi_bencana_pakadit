import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, View, Text, TouchableOpacity, StyleSheet, FlatList, Share, TextInput, Image, ScrollView, RefreshControl, Modal, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import Auth from './Auth';

const deteksiPulau = (wilayah) => {
  if (!wilayah) return 'Lainnya';
  const str = wilayah.toLowerCase();
  if (str.includes('jawa')) return 'Jawa';
  if (str.includes('sumatera') || str.includes('sumatra')) return 'Sumatera';
  if (str.includes('sulawesi')) return 'Sulawesi';
  if (str.includes('kalimantan')) return 'Kalimantan';
  if (str.includes('papua')) return 'Papua';
  if (str.includes('bali')) return 'Bali';
  if (str.includes('nusa tenggara') || str.includes('ntt') || str.includes('ntb') || str.includes('ruteng') || str.includes('manggarai')) return 'Nusa Tenggara';
  if (str.includes('maluku')) return 'Maluku';
  return 'Lainnya';
};

function MainApp({ session }) {
  const [bencana, setBencana] = useState([]);
  const [totalDonasi, setTotalDonasi] = useState(0);
  const [donasiLokal, setDonasiLokal] = useState({});
  const [filterAktif, setFilterAktif] = useState('Semua');
  const [kataKunci, setKataKunci] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [modalDonasiVisible, setModalDonasiVisible] = useState(false);
  const [gempaTerpilih, setGempaTerpilih] = useState(null);
  const [inputNominal, setInputNominal] = useState('');
  
  const [modalAdminVisible, setModalAdminVisible] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pesanAdmin, setPesanAdmin] = useState('');

  const fetchData = async () => {
    setRefreshing(true);
    try {
      // 1. Tarik data Auto Gempa HANYA untuk mengamankan 1 gambar pasti dari BMKG
      const resAuto = await fetch('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json');
      const dataAuto = await resAuto.json();
      const gambarUtama = dataAuto?.Infogempa?.gempa?.Shakemap || '';

      // 2. Tarik daftar gempa besar (Biasanya memiliki gambar)
      const resTerkini = await fetch('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json');
      const dataTerkini = await resTerkini.json();
      const listTerkini = dataTerkini.Infogempa.gempa || [];

      // 3. Tarik daftar gempa kecil/dirasakan (Sering kali TIDAK memiliki gambar)
      const resDirasakan = await fetch('https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json');
      const dataDirasakan = await resDirasakan.json();
      const listDirasakan = dataDirasakan.Infogempa.gempa || [];

      // 4. Gabungkan daftar dan suntikkan gambar secara cerdas
      const gabungan = [...listTerkini, ...listDirasakan].map(item => {
        // Jika data item memiliki file .jpg, gunakan file tersebut. 
        // Jika kosong (karena BMKG tidak buatkan), pinjam gambar dari Auto Gempa!
        const fileGambar = (item.Shakemap && item.Shakemap.includes('.jpg')) 
          ? item.Shakemap 
          : gambarUtama;
          
        return { 
          ...item, 
          ShakemapURL: `https://data.bmkg.go.id/DataMKG/TEWS/${fileGambar}` 
        };
      });

      // 5. Hapus data ganda (jika ada gempa yang muncul di kedua list API)
      const dataUnik = Array.from(new Map(gabungan.map(item => [item.DateTime, item])).values());
      
      // 6. Urutkan kembali berdasarkan waktu dari yang paling baru
      dataUnik.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));

      setBencana(dataUnik);
    } catch (err) {
      console.log('Gagal menarik data:', err);
    }
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
    loadDonasi();
  }, []);

  const loadDonasi = async () => {
    const savedTotal = await AsyncStorage.getItem('totalDonasi');
    const savedLokal = await AsyncStorage.getItem('donasiLokal');
    if (savedTotal) setTotalDonasi(parseInt(savedTotal));
    if (savedLokal) setDonasiLokal(JSON.parse(savedLokal));
  };

  const formatAngkaRibuan = (angka) => {
    const bersihkanNonAngka = angka.replace(/\D/g, '');
    return bersihkanNonAngka.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handleInputNominal = (teks) => {
    setInputNominal(formatAngkaRibuan(teks));
  };

  const eksekusiDonasiKustom = async () => {
    const angkaAsli = parseInt(inputNominal.replace(/\./g, ''), 10);
    
    if (!angkaAsli || angkaAsli <= 0) {
      return Alert.alert('Peringatan', 'Masukkan nominal donasi yang valid!');
    }

    if (!gempaTerpilih) return;
    const idGempa = gempaTerpilih.DateTime;
    
    const totalBaru = totalDonasi + angkaAsli;
    const donasiLokalBaru = {
      ...donasiLokal,
      [idGempa]: (donasiLokal[idGempa] || 0) + angkaAsli
    };
    
    setTotalDonasi(totalBaru);
    setDonasiLokal(donasiLokalBaru);
    
    await AsyncStorage.setItem('totalDonasi', totalBaru.toString());
    await AsyncStorage.setItem('donasiLokal', JSON.stringify(donasiLokalBaru));
    
    setModalDonasiVisible(false);
    setGempaTerpilih(null);
    setInputNominal('');
    
    Alert.alert('Terima Kasih!', `Donasi Rp${angkaAsli.toLocaleString('id-ID')} berhasil disalurkan.`);
  };

  const handleResetAdmin = async () => {
    if (pinInput.trim() === '1234') {
      setTotalDonasi(0);
      setDonasiLokal({});
      await AsyncStorage.removeItem('totalDonasi');
      await AsyncStorage.removeItem('donasiLokal');
      setPinInput('');
      setPesanAdmin('');
      setModalAdminVisible(false);
    } else {
      // Peringatan dibuat tegas tanpa membocorkan PIN
      setPesanAdmin('PIN Admin salah');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const hitungStatistikPulau = () => {
    const stats = { Semua: bencana.length };
    bencana.forEach(item => {
      const pulau = deteksiPulau(item.Wilayah);
      stats[pulau] = (stats[pulau] || 0) + 1;
    });
    return stats;
  };

  const statsPulau = hitungStatistikPulau();
  const daftarPulauDinamis = ['Semua', ...Object.keys(statsPulau).filter(k => k !== 'Semua' && k !== 'Lainnya')];

  const renderItem = ({ item }) => {
    const idGempa = item.DateTime;
    const pulau = deteksiPulau(item.Wilayah);
    
    if (filterAktif !== 'Semua' && pulau !== filterAktif) return null;
    if (kataKunci && !item.Wilayah.toLowerCase().includes(kataKunci.toLowerCase())) return null;

    return (
      <View style={styles.card}>
        {/* Gambar dijamin muncul karena logika suntik gambar (ShakemapURL) di atas */}
        <Image source={{ uri: item.ShakemapURL }} style={styles.cardImage} resizeMode="cover" />
        
        <View style={styles.cardContent}>
          <View style={styles.tagRow}>
            <View style={styles.tagPrimary}><Text style={styles.tagText}>⚡ BMKG REAL-TIME</Text></View>
            <View style={styles.tagSecondary}><Text style={styles.tagText}>🏝️ Pulau {pulau}</Text></View>
          </View>

          <Text style={styles.cardTitle}>Gempa M {item.Magnitude} - {item.Wilayah}</Text>
          <Text style={styles.cardSubtitle}>📍 Kedalaman {item.Kedalaman} | {item.Jam}, {item.Tanggal}</Text>

          <View style={styles.localDonationBox}>
            <Text style={styles.localDonationLabel}>Terkumpul di Lokasi Ini:</Text>
            <Text style={styles.localDonationValue}>Rp {(donasiLokal[idGempa] || 0).toLocaleString('id-ID')}</Text>
          </View>

          <Text style={styles.techDataTitle}>Data Teknis:</Text>
          <Text style={styles.techData}>• Koordinat: {item.Coordinates}</Text>
          <Text style={styles.techData}>• Info: {item.Dirasakan || 'Tidak ada laporan khusus'}</Text>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.btnDonate} onPress={() => { 
              setGempaTerpilih(item); 
              setInputNominal('');
              setModalDonasiVisible(true); 
            }}>
              <Text style={styles.btnDonateText}>❤️ Salurkan Donasi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnShare} onPress={() => Share.share({ message: `Info Bencana: Gempa M${item.Magnitude} di ${item.Wilayah}.` })}>
              <Text style={styles.btnShareText}>📣 Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🚨 PUSAT BENCANA V3.0</Text>
          <Text style={styles.headerSubtitle}>🔴 Sistem Siaga (Dark Mode)</Text>
        </View>
        <TouchableOpacity style={styles.btnRefresh} onPress={fetchData}>
          <Text style={styles.btnRefreshText}>🔄 Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dashboardCard}>
        <Text style={styles.dashboardLabel}>Total Donasi Darurat:</Text>
        <Text style={styles.dashboardValue}>Rp {totalDonasi.toLocaleString('id-ID')}</Text>
        <TouchableOpacity style={styles.btnReset} onPress={() => {
          setPesanAdmin(''); 
          setPinInput('');
          setModalAdminVisible(true);
        }}>
          <Text style={styles.btnResetText}>⚙️ Reset (Admin)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari lokasi..."
          placeholderTextColor="#9ca3af"
          value={kataKunci}
          onChangeText={setKataKunci}
        />
      </View>

      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {daftarPulauDinamis.map(pulau => (
            <TouchableOpacity 
              key={pulau} 
              onPress={() => setFilterAktif(pulau)} 
              style={[styles.filterChip, filterAktif === pulau && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, filterAktif === pulau && styles.filterChipTextActive]}>
                {pulau === 'Semua' ? 'Semua' : `Pulau ${pulau}`} ({statsPulau[pulau]})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={bencana}
        keyExtractor={item => item.DateTime}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor="#dc2626" />}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      <TouchableOpacity style={styles.btnLogout} onPress={handleLogout}>
        <Text style={styles.btnLogoutText}>Keluar Akun</Text>
      </TouchableOpacity>

      <Modal visible={modalDonasiVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Masukkan Nominal Donasi</Text>
            <Text style={styles.modalSub}>{gempaTerpilih?.Wilayah}</Text>
            
            <View style={styles.inputRpContainer}>
              <Text style={styles.rupiahPrefix}>Rp</Text>
              <TextInput
                style={styles.inputDonasiKustom}
                placeholder="0"
                placeholderTextColor="#6b7280"
                keyboardType="numeric"
                value={inputNominal}
                onChangeText={handleInputNominal}
              />
            </View>

            <TouchableOpacity style={styles.nominalBtn} onPress={eksekusiDonasiKustom}>
              <Text style={styles.nominalText}>Kirim Donasi</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalDonasiVisible(false)}>
              <Text style={styles.modalCloseText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalAdminVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Verifikasi Admin</Text>
            <Text style={styles.modalSub}>Masukkan PIN untuk mereset data</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Masukkan PIN"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              keyboardType="numeric"
              value={pinInput}
              onChangeText={(text) => setPinInput(text)}
            />

            {/* Peringatan error PIN Admin yang tegas (Tidak lagi menampilkan sandi 1234) */}
            {pesanAdmin ? <Text style={styles.pesanError}>{pesanAdmin}</Text> : null}

            <TouchableOpacity style={styles.nominalBtn} onPress={handleResetAdmin}>
              <Text style={styles.nominalText}>Konfirmasi Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalAdminVisible(false)}>
              <Text style={styles.modalCloseText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsReady(true);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  if (!isReady) return <View style={{ flex: 1, backgroundColor: '#121212' }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#121212' }}>
      <StatusBar barStyle="light-content" />
      {session && session.user ? <MainApp session={session} /> : <Auth />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  headerSubtitle: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  btnRefresh: { borderWidth: 1, borderColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  btnRefreshText: { color: '#ef4444', fontSize: 12, fontWeight: 'bold' },

  dashboardCard: { backgroundColor: '#7f1d1d', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16 },
  dashboardLabel: { color: '#fca5a5', fontSize: 14, marginBottom: 8 },
  dashboardValue: { color: '#ffffff', fontSize: 32, fontWeight: 'bold', marginBottom: 12 },
  btnReset: { backgroundColor: '#450a0a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  btnResetText: { color: '#fca5a5', fontSize: 12 },

  searchContainer: { flexDirection: 'row', backgroundColor: '#1f2937', borderRadius: 10, alignItems: 'center', paddingHorizontal: 12, marginBottom: 16 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: '#ffffff', paddingVertical: 12, fontSize: 14 },

  filterWrapper: { marginBottom: 16 },
  filterScroll: { flexDirection: 'row', alignItems: 'center' },
  filterChip: { borderWidth: 1, borderColor: '#dc2626', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 10 },
  filterChipActive: { backgroundColor: '#ef4444' },
  filterChipText: { color: '#dc2626', fontWeight: 'bold', fontSize: 13 },
  filterChipTextActive: { color: '#ffffff' },

  card: { backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 20, overflow: 'hidden' },
  cardImage: { width: '100%', height: 180, backgroundColor: '#0f172a' },
  cardContent: { padding: 16 },
  tagRow: { flexDirection: 'row', marginBottom: 12 },
  tagPrimary: { backgroundColor: '#450a0a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginRight: 8 },
  tagSecondary: { backgroundColor: '#0f766e', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  tagText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  
  cardTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  cardSubtitle: { color: '#94a3b8', fontSize: 13, marginBottom: 16 },
  
  localDonationBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 8, marginBottom: 16 },
  localDonationLabel: { color: '#94a3b8', fontSize: 12 },
  localDonationValue: { color: '#10b981', fontSize: 16, fontWeight: 'bold', marginTop: 4 },

  techDataTitle: { color: '#ffffff', fontSize: 13, fontWeight: 'bold', marginBottom: 4 },
  techData: { color: '#94a3b8', fontSize: 13, marginBottom: 2 },

  actionRow: { flexDirection: 'row', marginTop: 20 },
  btnDonate: { flex: 1.5, backgroundColor: '#ef4444', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginRight: 10 },
  btnDonateText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  btnShare: { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#64748b', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnShareText: { color: '#e2e8f0', fontWeight: 'bold', fontSize: 14 },

  btnLogout: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ef4444', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 4, marginBottom: 10 },
  btnLogoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: '100%', backgroundColor: '#1f2937', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#374151' },
  modalTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  modalSub: { color: '#9ca3af', fontSize: 13, marginBottom: 16, textAlign: 'center' },
  
  inputRpContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderRadius: 8, borderWidth: 1, borderColor: '#374151', marginBottom: 16, paddingHorizontal: 12 },
  rupiahPrefix: { color: '#9ca3af', fontSize: 18, fontWeight: 'bold', marginRight: 8 },
  inputDonasiKustom: { flex: 1, color: '#ffffff', fontSize: 18, fontWeight: 'bold', paddingVertical: 12 },

  nominalBtn: { backgroundColor: '#dc2626', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  nominalText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  modalInput: { backgroundColor: '#111827', color: '#ffffff', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#374151' },
  modalCloseBtn: { padding: 10, alignItems: 'center', marginTop: 4 },
  modalCloseText: { color: '#9ca3af', fontWeight: 'bold' },
  pesanError: { color: '#fca5a5', fontSize: 13, textAlign: 'center', marginBottom: 12, fontWeight: 'bold' } 
});