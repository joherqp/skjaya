import { User, Cabang } from './types';

// Cabang (Branches) - BOOTSTRAP DATA ONLY
export const cabangData: Cabang[] = [
  { id: 'cab-pusat', nama: 'Pusat (Head Office)', alamat: 'Jl. Sudirman No. 1', kota: 'Jakarta', telepon: '021-1234567' },
];

// Users - BOOTSTRAP DATA ONLY
export const usersData: User[] = [
  // Bootstrap Admin
  {
    id: 'usr-admin',
    username: 'admin',
    nama: 'Administrator',
    email: 'admin@cvskj.com',
    telepon: '081234567890',
    roles: ['admin'],
    cabangId: 'cab-pusat',
    isActive: true,
    createdAt: new Date('2024-01-01'),
  },
];
