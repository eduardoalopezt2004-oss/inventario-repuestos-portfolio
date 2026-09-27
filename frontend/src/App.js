import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AuthContext from './context/AuthContext';
import { OnlineStatusProvider } from './context/OnlineStatusContext';
import { DolarRateProvider } from './context/DolarRateContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Categories from './pages/Categories';
import Inventory from './pages/Inventory';
import StockMonitoring from './pages/StockMonitoring';
import Reports from './pages/Reports';
import Users from './pages/Users';
import ImportProveedores from './pages/ImportProveedores';
import ExportImport from './pages/ExportImport';
import Creditos from './pages/Creditos';
import HistorialCambios from './pages/HistorialCambios';

// Monta los Providers de estado solo cuando hay sesión activa.
// Así evitamos peticiones al backend sin token al cargar la app.
const AuthenticatedProviders = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading || !user) return <>{children}</>;
  return (
    <OnlineStatusProvider>
      <DolarRateProvider>
        {children}
      </DolarRateProvider>
    </OnlineStatusProvider>
  );
};

const PrivateRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Cargando...</span>
        </div>
      </div>
    );
  }

  return user ? <MainLayout>{children}</MainLayout> : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Cargando...</span>
        </div>
      </div>
    );
  }

  return user && user.rol === 'admin' ? (
    <MainLayout>{children}</MainLayout>
  ) : (
    <Navigate to="/" />
  );
};

const AppContent = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/productos"
          element={<Navigate to="/categorias" replace />}
        />
        <Route
          path="/ventas"
          element={
            <PrivateRoute>
              <Sales />
            </PrivateRoute>
          }
        />
        <Route
          path="/categorias"
          element={
            <AdminRoute>
              <Categories />
            </AdminRoute>
          }
        />
        <Route
          path="/inventario"
          element={
            <PrivateRoute>
              <Inventory />
            </PrivateRoute>
          }
        />
        <Route
          path="/historial-cambios"
          element={
            <AdminRoute>
              <HistorialCambios />
            </AdminRoute>
          }
        />
        <Route
          path="/stock"
          element={
            <PrivateRoute>
              <StockMonitoring />
            </PrivateRoute>
          }
        />
        <Route
          path="/creditos"
          element={
            <PrivateRoute>
              <Creditos />
            </PrivateRoute>
          }
        />
        <Route
          path="/reportes"
          element={
            <PrivateRoute>
              <Reports />
            </PrivateRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <AdminRoute>
              <Users />
            </AdminRoute>
          }
        />
        <Route
          path="/importar"
          element={
            <AdminRoute>
              <ImportProveedores />
            </AdminRoute>
          }
        />
        <Route
          path="/exportar"
          element={
            <AdminRoute>
              <ExportImport />
            </AdminRoute>
          }
        />
      </Routes>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <AuthenticatedProviders>
        <AppContent />
      </AuthenticatedProviders>
    </AuthProvider>
  );
}

export default App;
