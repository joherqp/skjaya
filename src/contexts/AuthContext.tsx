/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { User, UserRole } from '@/lib/types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  supabaseUser: SupabaseUser | null;
  updatePassword: (password: string) => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
  loginWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const createFallbackUser = (authUser: SupabaseUser): User => ({
    id: authUser.id,
    username: authUser.email?.split('@')[0] || 'user',
    nama: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
    email: authUser.email || '',
    telepon: authUser.phone || '-',
    roles: ['staff'], // Safe default
    cabangId: '550e8400-e29b-41d4-a716-446655440002', // Default Pusat
    isActive: false, // Default to inactive for new users
    createdAt: new Date(),
  });

  // Load user profile from database
  const loadUserProfile = async (authUser: SupabaseUser) => {
    console.log('loadUserProfile: Starting for', authUser.email);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', authUser.email)
        .single();

      console.log('loadUserProfile: Select result', { data, error });

      if (data) {
        // User exists, return profile
        return {
          id: data.id,
          username: data.username,
          nama: data.nama,
          email: data.email,
          telepon: data.telepon,
          roles: data.roles as UserRole[],
          cabangId: data.cabang_id,
          karyawanId: data.karyawan_id,
          avatarUrl: data.avatar_url,
          isActive: data.is_active,
          createdAt: new Date(data.created_at),
        } as User;
      }

      // User doesn't exist in public.users, create default profile
      console.log('loadUserProfile: User not found, creating default...');
      // Default to Pusat Branch
      const defaultCabangId = '550e8400-e29b-41d4-a716-446655440002';

      const newProfile = {
        id: authUser.id, // Link to Auth ID
        username: authUser.email?.split('@')[0] || 'user',
        nama: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
        email: authUser.email || '',
        telepon: authUser.phone || '-',
        roles: ['staff'],
        cabang_id: defaultCabangId,
        is_active: false, // Inactive by default, needs admin approval
      };

      const { data: newData, error: createError } = await supabase
        .from('users')
        .insert(newProfile)
        .select()
        .single();

      console.log('loadUserProfile: Create result', { newData, createError });

      if (createError) {
        console.error('Error creating user profile:', createError);
        return null;
      }

      if (newData) {
        return {
          id: newData.id,
          username: newData.username,
          nama: newData.nama,
          email: newData.email,
          telepon: newData.telepon,
          roles: newData.roles as UserRole[],
          cabangId: newData.cabang_id,
          karyawanId: newData.karyawan_id,
          avatarUrl: newData.avatar_url,
          isActive: newData.is_active,
          createdAt: new Date(newData.created_at),
        } as User;
      }

      return null;
    } catch (error) {
      console.error('Error loading user profile:', error);
      return null;
    }
  };

  // Initialize auth state
  useEffect(() => {
    console.log('AuthContext: Initializing...');
    // Check active session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('AuthContext: Session retrieved', session);
      if (session?.user) {
        console.log('AuthContext: User found, loading profile...');
        setSupabaseUser(session.user);

        // Strategy: Start loading profile. 
        // 1. If it returns quickly, great.
        // 2. If it takes > 10s, show fallback to unblock UI.
        // 3. Even after fallback, if real profile arrives, update it.

        let isProfileLoaded = false;

        // Start fetching
        const profilePromise = loadUserProfile(session.user).then(async (profile) => {
          if (profile) {
            console.log('AuthContext: Profile loaded (async)', profile);

            if (!profile.isActive) {
              console.warn('AuthContext: Account is inactive, logging out');
              toast.error('Akun Anda belum aktif. Silakan hubungi admin untuk aktivasi.');
              await supabase.auth.signOut();
              setUser(null);
              setSupabaseUser(null);
              return;
            }

            setUser(profile);
            isProfileLoaded = true;
          }
        });

        // Set timeout for fallback
        const timeoutPromise = new Promise<void>((resolve) => {
          setTimeout(() => {
            if (!isProfileLoaded) {
              console.warn('Profile load slow, using fallback temporarily');
              setUser(createFallbackUser(session.user));
              // We don't block the profilePromise from updating later
            }
            resolve();
          }, 10000); // 10s timeout
        });

        // We wait for either: profile loaded OR timeout passed
        // This ensures isLoading is set to false reasonably fast
        await Promise.race([profilePromise, timeoutPromise]);

      } else {
        console.log('AuthContext: No user session found');
      }
      console.log('AuthContext: Setting isLoading to false');
      setIsLoading(false);
    }).catch((err) => {
      console.error('Auth initialization error:', err);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        let isProfileLoaded = false;

        // Start fetching
        loadUserProfile(session.user).then(async (profile) => {
          if (profile) {
            if (!profile.isActive) {
              console.warn('AuthContext: Account is inactive (listener), logging out');
              toast.error('Akun Anda belum aktif. Silakan hubungi admin untuk aktivasi.');
              await supabase.auth.signOut();
              setUser(null);
              setSupabaseUser(null);
              return;
            }

            setUser(profile);
            isProfileLoaded = true;
          }
        });

        // Fallback timeout
        setTimeout(() => {
          if (!isProfileLoaded) {
            console.warn('Profile load slow (listener), using fallback temporarily');
            setUser(createFallbackUser(session.user));
          }
        }, 10000);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithGoogle = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/beranda'
        }
      });
      if (error) {
        console.error('Login error:', error);
        toast.error('Gagal login dengan Google');
      }
    } catch (error) {
      console.error('Login exception:', error);
      toast.error('Terjadi kesalahan, silakan coba lagi');
    }
  };

  // Keep a dummy login for backward compatibility in case it's called elsewhere, 
  // but we won't use it in our new UI.
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      console.warn('Email/password login is deprecated. Use Google Auth.');
      // For demo/development: Use email format for Supabase auth
      const email = username.includes('@') ? username : `${username}@cvskj.local`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return false;

      if (data.user) {
        const profile = await loadUserProfile(data.user);

        if (!profile?.isActive) {
          toast.error('Akun Anda dinonaktifkan. Hubungi admin.');
          await supabase.auth.signOut();
          return false;
        }

        setUser(profile);
        setSupabaseUser(data.user);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSupabaseUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updatePassword = async (password: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && user.isActive === true,
        isLoading,
        login,
        logout,
        supabaseUser,
        updatePassword,
        loginWithGoogle,
        hasRole: (roles: UserRole[]) => {
          if (!user || !user.isActive) return false;
          return roles.some(role => user.roles.includes(role));
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
