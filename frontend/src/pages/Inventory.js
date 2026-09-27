import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from '../services/api';
import { cacheProductos, getCachedProductos, cacheCategories, getCachedCategories } from '../utils/offlineQueue';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import EntradaInventario from '../components/Inventory/EntradaInventario';
import SalidaInventario from '../components/Inventory/SalidaInventario';
import TransferenciaInventario from '../components/Inventory/TransferenciaInventario';
import HistorialMovimientos from '../components/Inventory/HistorialMovimientos';
import AjustesPendientes from '../components/Inventory/AjustesPendientes';

const Inventory = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') || 'entrada';
  });
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  const { lastSyncAt } = useOnlineStatus();

  useEffect(() => {
    cargarProductos();
    cargarCategorias();
    cargarUsuario();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) setActiveTab(tab);
  }, [location.search]);

  useEffect(() => {
    if (lastSyncAt) {
      cargarProductos();
      cargarCategorias();
    }
  }, [lastSyncAt]);

  const cargarProductos = async () => {
    try {
      const response = await axios.get('/products', { params: { activo: true } });
      setProductos(response.data);
      cacheProductos(response.data);
    } catch (error) {
      const cached = getCachedProductos();
      if (cached) {
        setProductos(cached);
        toast.info('Mostrando productos en caché (sin conexión)');
      } else {
        console.error('Error al cargar productos:', error);
        toast.error('Error al cargar la lista de productos');
      }
    }
  };

  const cargarCategorias = async () => {
    try {
      const response = await axios.get('/categories');
      const data = response.data;
      const cats = Array.isArray(data) ? data : (data.categories || []);
      setCategorias(cats);
      cacheCategories(cats);
    } catch {
      const cached = getCachedCategories();
      if (cached) setCategorias(cached);
    }
  };

  const cargarUsuario = () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  };

  const handleMovimientoRegistrado = () => {
    cargarProductos();
    cargarCategorias();
  };

  return (
    <>
      <section className="content-header">
        <div className="container-fluid">
          <div className="row mb-2">
            <div className="col-sm-6">
              <h1>Gestión de Inventario</h1>
            </div>
          </div>
        </div>
      </section>

      <section className="content">
        <div className="container-fluid">
          {/* Tabs de navegación */}
          <div className="card">
            <div className="card-header p-2">
              <ul className="nav nav-pills">
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'entrada' ? 'active' : ''}`}
                    onClick={() => setActiveTab('entrada')}
                  >
                    <i className="fas fa-arrow-down mr-2"></i>
                    Entrada de Productos
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'salida' ? 'active' : ''}`}
                    onClick={() => setActiveTab('salida')}
                  >
                    <i className="fas fa-arrow-up mr-2"></i>
                    Salida de Productos
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'transferencia' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transferencia')}
                  >
                    <i className="fas fa-exchange-alt mr-2"></i>
                    Transferir al Local
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'historial' ? 'active' : ''}`}
                    onClick={() => setActiveTab('historial')}
                  >
                    <i className="fas fa-history mr-2"></i>
                    Historial
                  </button>
                </li>
                {user?.rol === 'admin' && (
                  <li className="nav-item">
                    <button
                      className={`nav-link ${activeTab === 'pendientes' ? 'active' : ''}`}
                      onClick={() => setActiveTab('pendientes')}
                    >
                      <i className="fas fa-clock mr-2"></i>
                      Ajustes Pendientes
                    </button>
                  </li>
                )}
              </ul>
            </div>
            <div className="card-body">
              <div className="tab-content">
                {activeTab === 'entrada' && (
                  <EntradaInventario
                    productos={productos}
                    categorias={categorias}
                    onSuccess={handleMovimientoRegistrado}
                  />
                )}
                {activeTab === 'salida' && (
                  <SalidaInventario
                    productos={productos}
                    onSuccess={handleMovimientoRegistrado}
                  />
                )}
                {activeTab === 'transferencia' && (
                  <TransferenciaInventario
                    productos={productos}
                    onSuccess={handleMovimientoRegistrado}
                  />
                )}
                {activeTab === 'historial' && (
                  <HistorialMovimientos productos={productos} />
                )}

                {activeTab === 'pendientes' && user?.rol === 'admin' && (
                  <AjustesPendientes onAprobado={handleMovimientoRegistrado} />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Inventory;
