import { supabase } from './supabase';
import { toast } from 'sonner';

export const seedDatabase = async () => {
    try {
        console.log('Starting seed process...');
        toast.info('Memulai proses seeding data lengkap...');

        // Defined UUIDs from SQL Migrations
        const adminId = '550e8400-e29b-41d4-a716-446655440003';
        const cabangId = '550e8400-e29b-41d4-a716-446655440002';
        const areaId = '550e8400-e29b-41d4-a716-446655440001';
        
        // Mock UUIDs
        const katElektronikId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
        const katMakananId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
        const satPcsId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21';
        const satBoxId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
        const katPelRetailId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31';

        // 0. Initial Schema Data (001)
        
        // Area
        await supabase.from('area').upsert([
            { id: areaId, nama: 'Jakarta Raya', kota: 'Jakarta' }
        ]);

        // Cabang
        await supabase.from('cabang').upsert([
            { id: cabangId, nama: 'Pusat (Head Office)', alamat: 'Jl. Sudirman No. 1', kota: 'Jakarta', telepon: '021-1234567', area_id: areaId }
        ]);

        // Profil Perusahaan
        await supabase.from('profil_perusahaan').upsert([
            { nama: 'CVSKJ', alamat: 'Jl. Sudirman No. 1, Jakarta', telepon: '021-1234567', email: 'info@cvskj.com', website: 'www.cvskj.com', deskripsi: 'Sistem Manajemen Distribusi' }
        ]);

        // Rekening Bank
        await supabase.from('rekening_bank').upsert([
            { nama_bank: 'Tunai', nomor_rekening: '-', atas_nama: 'Cash', is_tunai: true }
        ]);

        // Users (Ensure Admin exists / update it)
        // Note: Creating user via client might be restricted by RLS if not careful, but we'll try upsert.
        // If it fails, it means user likely exists or RLS blocks it.
        const { error: userError } = await supabase.from('users').upsert([
            { 
                id: adminId, 
                username: 'admin', 
                nama: 'Administrator', 
                email: 'herujohaeri@gmail.com', 
                telepon: '081234567890', 
                roles: ['admin'], 
                cabang_id: cabangId, 
                is_active: true 
            }
        ]);
        if (userError) console.warn('User upsert warning (might be RLS restricted):', userError);


        // 1. Kategori (007)
        await supabase.from('kategori').upsert([
            { id: katElektronikId, nama: 'Elektronik', deskripsi: 'Barang elektronik dan gadget' },
            { id: katMakananId, nama: 'Makanan', deskripsi: 'Makanan ringan dan sembako' }
        ]);

        // 2. Satuan
        await supabase.from('satuan').upsert([
            { id: satPcsId, nama: 'Pieces', simbol: 'Pcs' },
            { id: satBoxId, nama: 'Kotak', simbol: 'Box' }
        ]);

        // 3. Barang
        await supabase.from('barang').upsert([
            { 
                kode: 'LAP-001', 
                nama: 'Laptop Gaming ASUS', 
                harga_jual: 15000000, 
                harga_beli: 12000000, 
                stok: 5, 
                kategori_id: katElektronikId, 
                satuan_id: satPcsId,
                created_by: adminId
            },
            { 
                kode: 'ACC-001', 
                nama: 'Mouse Wireless Logitech', 
                harga_jual: 250000, 
                harga_beli: 150000, 
                stok: 20, 
                kategori_id: katElektronikId, 
                satuan_id: satPcsId,
                created_by: adminId 
            },
            { 
                kode: 'FOD-001', 
                nama: 'Kopi Kapal Api', 
                harga_jual: 15000, 
                harga_beli: 10000, 
                stok: 100, 
                kategori_id: katMakananId, 
                satuan_id: satPcsId,
                created_by: adminId 
            },
            { 
                kode: 'FOD-002', 
                nama: 'Indomie Goreng (Dus)', 
                harga_jual: 120000, 
                harga_beli: 105000, 
                stok: 50, 
                kategori_id: katMakananId, 
                satuan_id: satBoxId,
                created_by: adminId
            }
        ], { onConflict: 'kode' });

        // 4. Kategori Pelanggan
        await supabase.from('kategori_pelanggan').upsert([
            { id: katPelRetailId, nama: 'Retail', diskon: 0 }
        ]);

        // 5. Pelanggan
        await supabase.from('pelanggan').upsert([
            {
                kode: 'CUST-001',
                nama: 'Budi Santoso',
                alamat: 'Jl. Merdeka No. 45, Jakarta',
                telepon: '08123456789',
                email: 'budi@example.com',
                kategori_id: katPelRetailId,
                sales_id: adminId,
                cabang_id: cabangId,
                limit_kredit: 5000000,
                created_by: adminId
            },
            {
                kode: 'CUST-002',
                nama: 'Siti Aminah',
                alamat: 'Jl. Sudirman No. 10, Jakarta',
                telepon: '08987654321',
                email: 'siti@example.com',
                kategori_id: katPelRetailId,
                sales_id: adminId,
                cabang_id: cabangId,
                limit_kredit: 2000000,
                created_by: adminId
            }
        ], { onConflict: 'kode' });


        // 6. Absensi (Check logic to avoid duplicates based on user + date if RLS allows)
        // Note: Absensi doesn't have a unique constraint on date in schema, so we need careful insertion or just insert always
        // But for mock data, let's look for existing for today first to avoid double seed on multiple clicks
        
        // We will insert for the CURRENT USER to verify functionality, 
        // AND for the Mock Admin if possible.
        
        const { data: { user } } = await supabase.auth.getUser();
        const targetUserId = user ? user.id : adminId;

        // Check if already present for today for this user
        const today = new Date().toISOString().split('T')[0];
        const { data: existingAbsensi } = await supabase
            .from('absensi')
            .select('id')
            .eq('user_id', targetUserId)
            .gte('tanggal', `${today}T00:00:00`)
            .lte('tanggal', `${today}T23:59:59`)
            .maybeSingle();

        if (!existingAbsensi) {
             await supabase.from('absensi').insert([
                { 
                    user_id: targetUserId, 
                    tanggal: new Date(), 
                    check_in: new Date(), 
                    lokasi_check_in: {latitude: -6.2088, longitude: 106.8456, alamat: "Jakarta Pusat (Mock)"}, 
                    status: 'hadir', 
                    keterangan: 'Auto Seeded Data'
                }
            ]);
        }

        toast.success('Database berhasil di-synchronize! (001 & 007 processed)');
        setTimeout(() => window.location.reload(), 1500);

    } catch (error: unknown) {
        console.error('Seeding failed:', error);
        toast.error(`Gagal seeding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
