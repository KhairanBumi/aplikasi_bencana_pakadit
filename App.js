import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, Image, ScrollView, RefreshControl, Modal, Alert } from 'react-native';
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

const daftarYayasan = ['PMI', 'Dompet Dhuafa', 'Baznas', 'Kitabisa'];
const daftarLogistik = [
  { id: 'sembako', nama: 'Sembako', satuan: 'Paket', icon: '📦' },
  { id: 'pakaian', nama: 'Pakaian', satuan: 'Dus', icon: '👕' },
  { id: 'tenda', nama: 'Tenda', satuan: 'Unit', icon: '⛺' },
  { id: 'obat', nama: 'Obat-obatan', satuan: 'Box', icon: '💊' }
];

function MainApp({ session }) {
  const [bencana, setBencana] = useState([]);
  const [totalDonasi, setTotalDonasi] = useState(0);
  const [donasiLokal, setDonasiLokal] = useState({});
  const [filterAktif, setFilterAktif] = useState('Semua');
  const [kataKunci, setKataKunci] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [modalDonasiVisible, setModalDonasiVisible] = useState(false);
  const [gempaTerpilih, setGempaTerpilih] = useState(null);
  const [yayasanTerpilih, setYayasanTerpilih] = useState(null);
  const [tipeDonasi, setTipeDonasi] = useState('uang'); // 'uang' atau 'logistik'
  
  // State Uang
  const [inputNominal, setInputNominal] = useState('');
  
  // State Logistik
  const [barangTerpilih, setBarangTerpilih] = useState(null);
  const [jumlahBarang, setJumlahBarang] = useState('');
  
  // Admin State
  const [modalAdminVisible, setModalAdminVisible] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pesanAdmin, setPesanAdmin] = useState('');
  const [resetGempaId, setResetGempaId] = useState(null);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const resAuto = await fetch('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json');
      const dataAuto = await resAuto.json();
      const gambarUtama = dataAuto?.Infogempa?.gempa?.Shakemap || '';

      const resTerkini = await fetch('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json');
      const dataTerkini = await resTerkini.json();
      const listTerkini = dataTerkini.Infogempa.gempa || [];

      const resDirasakan = await fetch('https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json');
      const dataDirasakan = await resDirasakan.json();
      const listDirasakan = dataDirasakan.Infogempa.gempa || [];

      const gabungan = [...listTerkini, ...listDirasakan].map(item => {
        const fileGambar = (item.Shakemap && item.Shakemap.includes('.jpg')) ? item.Shakemap : gambarUtama;
        return { ...item, ShakemapURL: `https://data.bmkg.go.id/DataMKG/TEWS/${fileGambar}` };
      });

      const dataUnik = Array.from(new Map(gabungan.map(item => [item.DateTime, item])).values());
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

  const eksekusiDonasiKustom = async () => {
    if (!yayasanTerpilih) return Alert.alert('Peringatan', 'Silakan pilih yayasan penyalur terlebih dahulu!');
    if (!gempaTerpilih) return;

    const idGempa = gempaTerpilih.DateTime;
    const namaRelawan = session?.user?.email ? session.user.email.split('@')[0] : 'Anonim';
    
    const dataLama = donasiLokal[idGempa] || { total: 0, riwayat: [] };
    const totalLama = typeof dataLama === 'number' ? dataLama : (dataLama.total || 0);
    const riwayatLama = dataLama.riwayat || [];

    let objekRiwayatBaru = { 
      nama: namaRelawan, 
      waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' }),
      yayasan: yayasanTerpilih,
      tipe: tipeDonasi
    };

    let totalBaru = totalLama; // Total Rp wilayah
    let akumulasiTotalNasional = totalDonasi; // Total Rp nasional

    if (tipeDonasi === 'uang') {
      const angkaAsli = parseInt(inputNominal.replace(/\./g, ''), 10);
      if (!angkaAsli || angkaAsli <= 0) return Alert.alert('Peringatan', 'Masukkan nominal donasi yang valid!');
      
      objekRiwayatBaru.nominal = angkaAsli;
      totalBaru += angkaAsli;
      akumulasiTotalNasional += angkaAsli;

    } else {
      if (!barangTerpilih) return Alert.alert('Peringatan', 'Pilih jenis logistik yang didonasikan!');
      const jml = parseInt(jumlahBarang, 10);
      if (!jml || jml <= 0) return Alert.alert('Peringatan', 'Masukkan jumlah barang yang valid!');
      
      objekRiwayatBaru.barang = barangTerpilih.nama;
      objekRiwayatBaru.jumlah = jml;
      objekRiwayatBaru.satuan = barangTerpilih.satuan;
      objekRiwayatBaru.icon = barangTerpilih.icon;
    }

    const donasiWilayahBaru = { total: totalBaru, riwayat: [objekRiwayatBaru, ...riwayatLama] };
    const donasiLokalBaru = { ...donasiLokal, [idGempa]: donasiWilayahBaru };
    
    setTotalDonasi(akumulasiTotalNasional);
    setDonasiLokal(donasiLokalBaru);
    
    await AsyncStorage.setItem('totalDonasi', akumulasiTotalNasional.toString());
    await AsyncStorage.setItem('donasiLokal', JSON.stringify(donasiLokalBaru));
    
    // Reset Modal State
    setModalDonasiVisible(false);
    setGempaTerpilih(null);
    setInputNominal('');
    setJumlahBarang('');
    setBarangTerpilih(null);
    setYayasanTerpilih(null);
    setTipeDonasi('uang');
    
    Alert.alert('Terima Kasih!', `Donasi Anda via ${yayasanTerpilih} telah dicatat dalam sistem.`);
  };

  const handleResetAdmin = async () => {
    if (pinInput.trim() === '1234') {
      if (resetGempaId) {
        const dataLama = donasiLokal[resetGempaId];
        const uangDihapus = typeof dataLama === 'number' ? dataLama : (dataLama?.total || 0);
        
        const donasiLokalBaru = { ...donasiLokal };
        delete donasiLokalBaru[resetGempaId];
        
        const totalBaru = Math.max(0, totalDonasi - uangDihapus);

        setTotalDonasi(totalBaru);
        setDonasiLokal(donasiLokalBaru);
        await AsyncStorage.setItem('totalDonasi', totalBaru.toString());
        await AsyncStorage.setItem('donasiLokal', JSON.stringify(donasiLokalBaru));
        
        Alert.alert('Berhasil', 'Data donasi wilayah ini telah direset.');
      }
      setPinInput('');
      setPesanAdmin('');
      setModalAdminVisible(false);
      setResetGempaId(null);
    } else {
      setPesanAdmin('PIN Admin salah');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const renderRiwayatItem = (rw, index) => {
    if (rw.tipe === 'logistik') {
      return (
        <View key={index} style={styles.riwayatItemRow}>
          <Text style={styles.riwayatItemText}>
            👤 {rw.nama.toUpperCase()} <Text style={{fontSize: 10, color: '#9ca3af'}}>(via {rw.yayasan})</Text>
          </Text>
          <Text style={styles.riwayatItemLogistik}>{rw.icon} +{rw.jumlah} {rw.satuan} {rw.barang}</Text>
        </View>
      );
    }
    return (
      <View key={index} style={styles.riwayatItemRow}>
        <Text style={styles.riwayatItemText}>
          👤 {rw.nama.toUpperCase()} <Text style={{fontSize: 10, color: '#9ca3af'}}>(via {rw.yayasan || 'Umum'})</Text>
        </Text>
        <Text style={styles.riwayatItemUang}>+Rp {(rw.nominal || 0).toLocaleString('id-ID')}</Text>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const idGempa = item.DateTime;
    const pulau = deteksiPulau(item.Wilayah);
    
    if (filterAktif !== 'Semua' && pulau !== filterAktif) return null;
    if (kataKunci && !item.Wilayah.toLowerCase().includes(kataKunci.toLowerCase())) return null;

    const dataWilayah = donasiLokal[idGempa] || { total: 0, riwayat: [] };
    const totalWilayah = typeof dataWilayah === 'number' ? dataWilayah : (dataWilayah.total || 0);
    const riwayatWilayah = dataWilayah.riwayat || [];

    return (
      <View style={styles.card}>
        <Image source={{ uri: item.ShakemapURL }} style={styles.cardImage} resizeMode="cover" />
        <View style={styles.cardContent}>
          <View style={styles.tagRow}>
            <View style={styles.tagPrimary}><Text style={styles.tagText}>⚡ BMKG REAL-TIME</Text></View>
            <View style={styles.tagSecondary}><Text style={styles.tagText}>🏝️ Pulau {pulau}</Text></View>
          </View>
          <Text style={styles.cardTitle}>Gempa M {item.Magnitude} - {item.Wilayah}</Text>
          <Text style={styles.cardSubtitle}>📍 Kedalaman {item.Kedalaman} | {item.Jam}, {item.Tanggal}</Text>
          <View style={styles.localDonationBox}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.localDonationLabel}>Terkumpul Dana Lokal:</Text>
                <Text style={styles.localDonationValue}>Rp {totalWilayah.toLocaleString('id-ID')}</Text>
              </View>
              <TouchableOpacity style={styles.btnResetWilayah} onPress={() => { setResetGempaId(idGempa); setPesanAdmin(''); setPinInput(''); setModalAdminVisible(true); }}>
                <Text style={styles.btnResetWilayahText}>⚙️ Reset</Text>
              </TouchableOpacity>
            </View>
            {riwayatWilayah.length > 0 && (
              <View style={styles.riwayatContainer}>
                <Text style={styles.riwayatTitle}>Riwayat Bantuan Masuk:</Text>
                {riwayatWilayah.map((rw, index) => renderRiwayatItem(rw, index))}
              </View>
            )}
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.btnDonate} onPress={() => { 
              setGempaTerpilih(item); 
              setInputNominal('');
              setJumlahBarang('');
              setBarangTerpilih(null);
              setYayasanTerpilih(null);
              setTipeDonasi('uang');
              setModalDonasiVisible(true); 
            }}>
              <Text style={styles.btnDonateText}>❤️ Salurkan Bantuan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const statsPulau = hitungStatistikPulau(bencana);
  const daftarPulauDinamis = ['Semua', ...Object.keys(statsPulau).filter(k => k !== 'Semua' && k !== 'Lainnya')];

  function hitungStatistikPulau(data) {
    const stats = { Semua: data.length };
    data.forEach(item => {
      const pulau = deteksiPulau(item.Wilayah);
      stats[pulau] = (stats[pulau] || 0) + 1;
    });
    return stats;
  }

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
        <Text style={styles.dashboardLabel}>Total Donasi Darurat Nasional:</Text>
        <Text style={styles.dashboardValue}>Rp {totalDonasi.toLocaleString('id-ID')}</Text>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput style={styles.searchInput} placeholder="Cari lokasi..." placeholderTextColor="#9ca3af" value={kataKunci} onChangeText={setKataKunci} />
      </View>

      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {daftarPulauDinamis.map(pulau => (
            <TouchableOpacity key={pulau} onPress={() => setFilterAktif(pulau)} style={[styles.filterChip, filterAktif === pulau && styles.filterChipActive]}>
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

      <TouchableOpacity style={styles.btnLogout} onPress={handleLogout}><Text style={styles.btnLogoutText}>Keluar Akun</Text></TouchableOpacity>

      {/* Modal Donasi (Uang & Logistik) */}
      <Modal visible={modalDonasiVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Salurkan Bantuan</Text>
            <Text style={styles.modalSub}>{gempaTerpilih?.Wilayah}</Text>
            
            {/* Tab Navigasi Uang / Barang */}
            <View style={styles.tabContainer}>
              <TouchableOpacity style={[styles.tabBtn, tipeDonasi === 'uang' && styles.tabBtnAktif]} onPress={() => setTipeDonasi('uang')}>
                <Text style={[styles.tabText, tipeDonasi === 'uang' && styles.tabTextAktif]}>💵 Dana/Uang</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabBtn, tipeDonasi === 'logistik' && styles.tabBtnAktif]} onPress={() => setTipeDonasi('logistik')}>
                <Text style={[styles.tabText, tipeDonasi === 'logistik' && styles.tabTextAktif]}>📦 Logistik</Text>
              </TouchableOpacity>
            </View>

            {/* Input berdasarkan Tab */}
            {tipeDonasi === 'uang' ? (
              <View style={styles.inputRpContainer}>
                <Text style={styles.rupiahPrefix}>Rp</Text>
                <TextInput style={styles.inputDonasiKustom} placeholder="0" placeholderTextColor="#6b7280" keyboardType="numeric" value={inputNominal} onChangeText={(text) => setInputNominal(formatAngkaRibuan(text))} />
              </View>
            ) : (
              <View>
                <View style={styles.logistikGrid}>
                  {daftarLogistik.map((item) => (
                    <TouchableOpacity key={item.id} style={[styles.logistikBtn, barangTerpilih?.id === item.id && styles.logistikBtnAktif]} onPress={() => setBarangTerpilih(item)}>
                      <Text style={styles.logistikIcon}>{item.icon}</Text>
                      <Text style={[styles.logistikText, barangTerpilih?.id === item.id && styles.logistikTextAktif]}>{item.nama}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {barangTerpilih && (
                  <View style={styles.inputJumlahContainer}>
                    <Text style={styles.jumlahLabel}>Jumlah ({barangTerpilih.satuan}):</Text>
                    <TextInput style={styles.inputJumlah} placeholder="0" placeholderTextColor="#6b7280" keyboardType="numeric" value={jumlahBarang} onChangeText={setJumlahBarang} />
                  </View>
                )}
              </View>
            )}

            <Text style={styles.yayasanLabel}>Pilih Mitra Penyalur:</Text>
            <View style={styles.yayasanContainer}>
              {daftarYayasan.map((yayasan) => (
                <TouchableOpacity key={yayasan} style={[styles.yayasanBtn, yayasanTerpilih === yayasan && styles.yayasanBtnAktif]} onPress={() => setYayasanTerpilih(yayasan)}>
                  <Text style={[styles.yayasanText, yayasanTerpilih === yayasan && styles.yayasanTextAktif]}>{yayasan}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.nominalBtn} onPress={eksekusiDonasiKustom}>
              <Text style={styles.nominalText}>Konfirmasi Penyaluran</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalDonasiVisible(false)}>
              <Text style={styles.modalCloseText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Admin */}
      <Modal visible={modalAdminVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Akses Admin Wilayah</Text>
            <TextInput style={styles.modalInput} placeholder="Masukkan PIN" placeholderTextColor="#9ca3af" secureTextEntry keyboardType="numeric" value={pinInput} onChangeText={setPinInput} />
            {pesanAdmin ? <Text style={styles.pesanError}>{pesanAdmin}</Text> : null}
            <TouchableOpacity style={styles.nominalBtn} onPress={handleResetAdmin}><Text style={styles.nominalText}>Konfirmasi Reset</Text></TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setModalAdminVisible(false); setResetGempaId(null); }}><Text style={styles.modalCloseText}>Batal</Text></TouchableOpacity>
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
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setIsReady(true); });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); });
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
  dashboardValue: { color: '#ffffff', fontSize: 32, fontWeight: 'bold', marginBottom: 4 },
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
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  localDonationLabel: { color: '#94a3b8', fontSize: 12 },
  localDonationValue: { color: '#10b981', fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  btnResetWilayah: { backgroundColor: '#450a0a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#7f1d1d' },
  btnResetWilayahText: { color: '#fca5a5', fontSize: 11, fontWeight: 'bold' },
  riwayatContainer: { marginTop: 12, borderTopWidth: 1, borderColor: '#1e293b', paddingTop: 10 },
  riwayatTitle: { color: '#9ca3af', fontSize: 12, marginBottom: 8, fontWeight: 'bold' },
  riwayatItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' },
  riwayatItemText: { color: '#cbd5e1', fontSize: 12, fontWeight: '500', flex: 1 },
  riwayatItemUang: { color: '#10b981', fontSize: 12, fontWeight: 'bold' },
  riwayatItemLogistik: { color: '#3b82f6', fontSize: 12, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', marginTop: 20 },
  btnDonate: { flex: 1, backgroundColor: '#ef4444', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnDonateText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  btnLogout: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ef4444', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 4, marginBottom: 10 },
  btnLogoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: '100%', backgroundColor: '#1f2937', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#374151' },
  modalTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  modalSub: { color: '#9ca3af', fontSize: 13, marginBottom: 16, textAlign: 'center' },
  
  // Tab Styling
  tabContainer: { flexDirection: 'row', marginBottom: 16, backgroundColor: '#111827', borderRadius: 8, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  tabBtnAktif: { backgroundColor: '#374151' },
  tabText: { color: '#6b7280', fontSize: 14, fontWeight: 'bold' },
  tabTextAktif: { color: '#ffffff' },

  inputRpContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderRadius: 8, borderWidth: 1, borderColor: '#374151', marginBottom: 16, paddingHorizontal: 12 },
  rupiahPrefix: { color: '#9ca3af', fontSize: 18, fontWeight: 'bold', marginRight: 8 },
  inputDonasiKustom: { flex: 1, color: '#ffffff', fontSize: 18, fontWeight: 'bold', paddingVertical: 12 },

  // Logistik Styling
  logistikGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 12 },
  logistikBtn: { width: '48%', backgroundColor: '#111827', borderWidth: 1, borderColor: '#374151', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 10 },
  logistikBtnAktif: { borderColor: '#3b82f6', backgroundColor: '#1e3a8a' },
  logistikIcon: { fontSize: 24, marginBottom: 4 },
  logistikText: { color: '#9ca3af', fontSize: 12, fontWeight: 'bold' },
  logistikTextAktif: { color: '#60a5fa' },
  inputJumlahContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, backgroundColor: '#111827', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#374151' },
  jumlahLabel: { color: '#9ca3af', fontSize: 14, fontWeight: 'bold' },
  inputJumlah: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', paddingVertical: 12, textAlign: 'right', flex: 1 },

  yayasanLabel: { color: '#9ca3af', fontSize: 12, marginBottom: 8, fontWeight: 'bold' },
  yayasanContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, justifyContent: 'space-between' },
  yayasanBtn: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#374151', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, width: '48%', marginBottom: 8, alignItems: 'center' },
  yayasanBtnAktif: { backgroundColor: '#450a0a', borderColor: '#ef4444' },
  yayasanText: { color: '#9ca3af', fontSize: 12, fontWeight: 'bold' },
  yayasanTextAktif: { color: '#ef4444' },
  nominalBtn: { backgroundColor: '#dc2626', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  nominalText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  modalInput: { backgroundColor: '#111827', color: '#ffffff', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#374151', textAlign: 'center', fontSize: 18, letterSpacing: 5 },
  modalCloseBtn: { padding: 10, alignItems: 'center', marginTop: 4 },
  modalCloseText: { color: '#9ca3af', fontWeight: 'bold' },
  pesanError: { color: '#fca5a5', fontSize: 13, textAlign: 'center', marginBottom: 12, fontWeight: 'bold' } 
});