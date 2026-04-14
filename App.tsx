import React, { useState } from 'react';
import { Login } from './pages/Login';
import { WorkspaceHub } from './pages/WorkspaceHub';
import { User } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {!user ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <WorkspaceHub onLogout={handleLogout} user={user} />
      )}
    </div>
  );
};

export default App;