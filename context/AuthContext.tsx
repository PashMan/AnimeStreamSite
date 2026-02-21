
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { db } from '../services/db';

interface AuthContextType {
  user: User | null;
  login: (credentials: { email: string; password: string }) => Promise<boolean>;
  register: (data: { name: string; email: string; password: string }) => Promise<boolean>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('as_session');
    return saved ? JSON.parse(saved) : null;
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('as_session', JSON.stringify(user));
    } else {
      localStorage.removeItem('as_session');
    }
  }, [user]);

  const login = async (credentials: { email: string; password: string }) => {
    try {
      const foundUser = await db.login(credentials);
      if (foundUser) {
        setUser(foundUser);
        closeAuthModal();
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const register = async (data: { name: string; email: string; password: string }) => {
    try {
      const newUser = await db.register(data);
      if (newUser) {
        setUser(newUser);
        closeAuthModal();
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const logout = () => {
    setUser(null);
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user?.email) return false;
    const updatedUser = await db.updateProfile(user.email, updates);
    if (updatedUser) {
      setUser(updatedUser);
      return true;
    }
    return false;
  };

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateProfile, isAuthModalOpen, openAuthModal, closeAuthModal }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};