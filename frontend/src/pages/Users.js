import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { enqueue, cacheUsers, getCachedUsers } from '../utils/offlineQueue';

const Users = () => {
  const { isOnline, lastSyncAt, refreshCount } = useOnlineStatus();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'vendedor',
    activo: true
  });

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => { if (lastSyncAt) fetchUsers(); }, [lastSyncAt]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/auth/users');
      setUsers(response.data);
      cacheUsers(response.data);
    } catch {
      const cached = getCachedUsers();
      if (cached) {
        setUsers(cached);
        toast.info('Mostrando usuarios en caché (sin conexión)');
      } else {
        toast.error('Error al cargar los usuarios');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleShowModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        nombre: user.nombre,
        email: user.email,
        password: '',
        rol: user.rol,
        activo: user.activo
      });
    } else {
      setEditingUser(null);
      setFormData({
        nombre: '',
        email: '',
        password: '',
        rol: 'vendedor',
        activo: true
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({
      nombre: '',
      email: '',
      password: '',
      rol: 'vendedor',
      activo: true
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // ── SIN CONEXIÓN ──
    if (!isOnline) {
      if (editingUser) {
        enqueue('user-update', `/auth/users/${editingUser._id}`, 'put', formData);
        const cached = getCachedUsers() || [];
        cacheUsers(cached.map(u => u._id === editingUser._id ? { ...u, ...formData } : u));
        toast.info('Sin conexión — usuario actualizado localmente. Se sincronizará al reconectarse.');
      } else {
        const queued = enqueue('user-create', '/auth/register', 'post', formData);
        const cached = getCachedUsers() || [];
        cacheUsers([...cached, { ...formData, _id: queued.tempId, activo: true, _offline: true, createdAt: new Date().toISOString() }]);
        toast.info('Sin conexión — usuario guardado localmente. Se sincronizará al reconectarse.');
      }
      refreshCount();
      fetchUsers();
      handleCloseModal();
      setLoading(false);
      return;
    }

    // ── CON CONEXIÓN ──
    try {
      if (editingUser) {
        await api.put(`/auth/users/${editingUser._id}`, formData);
        toast.success('Usuario actualizado exitosamente');
      } else {
        await api.post('/auth/register', formData);
        toast.success('Usuario creado exitosamente');
      }
      fetchUsers();
      handleCloseModal();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar el usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este usuario?')) return;

    setLoading(true);

    // ── SIN CONEXIÓN ──
    if (!isOnline) {
      enqueue('user-delete', `/auth/users/${userId}`, 'delete', null);
      const cached = getCachedUsers() || [];
      cacheUsers(cached.filter(u => u._id !== userId));
      refreshCount();
      toast.info('Sin conexión — eliminación guardada localmente. Se sincronizará al reconectarse.');
      fetchUsers();
      setLoading(false);
      return;
    }

    // ── CON CONEXIÓN ──
    try {
      await api.delete(`/auth/users/${userId}`);
      toast.success('Usuario eliminado exitosamente');
      fetchUsers();
    } catch (error) {
      toast.error('Error al eliminar el usuario');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (user) => {
    setLoading(true);
    const updatedData = { ...user, activo: !user.activo };

    // ── SIN CONEXIÓN ──
    if (!isOnline) {
      enqueue('user-update', `/auth/users/${user._id}`, 'put', updatedData);
      const cached = getCachedUsers() || [];
      cacheUsers(cached.map(u => u._id === user._id ? updatedData : u));
      refreshCount();
      toast.info(`Sin conexión — usuario ${!user.activo ? 'activado' : 'desactivado'} localmente. Se sincronizará al reconectarse.`);
      fetchUsers();
      setLoading(false);
      return;
    }

    // ── CON CONEXIÓN ──
    try {
      await api.put(`/auth/users/${user._id}`, updatedData);
      toast.success(`Usuario ${!user.activo ? 'activado' : 'desactivado'} exitosamente`);
      fetchUsers();
    } catch (error) {
      toast.error('Error al cambiar el estado del usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-wrapper">
      <div className="content-header">
        <div className="container-fluid">
          <div className="row mb-2">
            <div className="col-sm-6">
              <h1 className="m-0">
                <i className="fas fa-users-cog mr-2"></i>
                Gestión de Usuarios
              </h1>
            </div>
            <div className="col-sm-6">
              <button
                className="btn btn-primary float-right"
                onClick={() => handleShowModal()}
              >
                <i className="fas fa-plus mr-2"></i>
                Nuevo Usuario
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="content">
        <div className="container-fluid">
          {/* Estadísticas */}
          <div className="row mb-4">
            <div className="col-lg-3 col-6">
              <div className="info-box">
                <span className="info-box-icon bg-primary">
                  <i className="fas fa-users"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Total Usuarios</span>
                  <span className="info-box-number">{users.length}</span>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-6">
              <div className="info-box">
                <span className="info-box-icon bg-success">
                  <i className="fas fa-user-shield"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Administradores</span>
                  <span className="info-box-number">
                    {users.filter(u => u.rol === 'admin').length}
                  </span>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-6">
              <div className="info-box">
                <span className="info-box-icon bg-info">
                  <i className="fas fa-user-tag"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Vendedores</span>
                  <span className="info-box-number">
                    {users.filter(u => u.rol === 'vendedor').length}
                  </span>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-6">
              <div className="info-box">
                <span className="info-box-icon bg-success">
                  <i className="fas fa-check-circle"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Usuarios Activos</span>
                  <span className="info-box-number">
                    {users.filter(u => u.activo).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de usuarios */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Lista de Usuarios</h3>
            </div>
            <div className="card-body">
              {loading && users.length === 0 ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="sr-only">Cargando...</span>
                  </div>
                </div>
              ) : users.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-users"></i>
                  <h4>No hay usuarios registrados</h4>
                  <p>Comienza agregando un nuevo usuario</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Fecha Registro</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user._id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div className="user-avatar" style={{ width: '40px', height: '40px', fontSize: '1rem' }}>
                                {user.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600 }}>{user.nombre}</div>
                              </div>
                            </div>
                          </td>
                          <td>{user.email}</td>
                          <td>
                            <span className={`badge ${user.rol === 'admin' ? 'badge-success' : 'badge-info'}`}>
                              {user.rol === 'admin' ? 'Administrador' : 'Vendedor'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${user.activo ? 'badge-success' : 'badge-danger'}`}>
                              {user.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                          <td>
                            <div className="btn-group">
                              <button
                                className="btn btn-sm btn-info"
                                onClick={() => handleShowModal(user)}
                                title="Editar"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                className={`btn btn-sm ${user.activo ? 'btn-warning' : 'btn-success'}`}
                                onClick={() => toggleUserStatus(user)}
                                title={user.activo ? 'Desactivar' : 'Activar'}
                              >
                                <i className={`fas fa-${user.activo ? 'ban' : 'check'}`}></i>
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDelete(user._id)}
                                title="Eliminar"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal para crear/editar usuario */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Nombre Completo</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Ingrese el nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </Form.Group>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Contraseña {editingUser && '(dejar en blanco para no cambiar)'}</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Rol</Form.Label>
                  <Form.Select
                    value={formData.rol}
                    onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                    required
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="admin">Administrador</option>
                  </Form.Select>
                </Form.Group>
              </div>
            </div>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Usuario Activo"
                checked={formData.activo}
                onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Guardando...
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-2"></i>
                  {editingUser ? 'Actualizar' : 'Crear'} Usuario
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Users;
