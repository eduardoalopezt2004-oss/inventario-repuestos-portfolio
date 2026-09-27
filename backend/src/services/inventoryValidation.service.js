const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');

/**
 * Servicio de validaciones de negocio para movimientos de inventario
 * Previene errores comunes y pérdidas en la gestión de inventario
 */
class InventoryValidationService {
  /**
   * Valida que un producto exista y esté activo
   */
  async validarProductoExistente(productoId) {
    const producto = await Product.findById(productoId);

    if (!producto) {
      throw new Error('El producto no existe');
    }

    if (!producto.activo) {
      throw new Error('El producto está desactivado. No se pueden realizar movimientos sobre él');
    }

    return producto;
  }

  /**
   * Valida que haya suficiente stock local para una salida
   */
  async validarStockSuficiente(productoId, cantidad) {
    const producto = await Product.findById(productoId);
    const stockLocal = producto.stockLocal || 0;

    if (stockLocal < cantidad) {
      throw new Error(
        `Stock insuficiente en local. Disponible: ${stockLocal}, Solicitado: ${cantidad}`
      );
    }

    return true;
  }

  /**
   * Valida que la cantidad no exceda límites razonables
   */
  validarCantidadRazonable(cantidad, tipo, stockActual) {
    // Validar cantidad positiva
    if (cantidad <= 0) {
      throw new Error('La cantidad debe ser mayor a 0');
    }

    // Validar que sea un número entero
    if (!Number.isInteger(cantidad)) {
      throw new Error('La cantidad debe ser un número entero');
    }

    // Para salidas, no puede exceder el stock local
    if (['SALIDA', 'AJUSTE_SALIDA'].includes(tipo) && cantidad > stockActual) {
      throw new Error(
        `No se puede retirar más de lo disponible en local. Stock local: ${stockActual}, Solicitado: ${cantidad}`
      );
    }

    // Validar cantidad máxima por movimiento (prevención de errores)
    const CANTIDAD_MAXIMA = 10000;
    if (cantidad > CANTIDAD_MAXIMA) {
      throw new Error(
        `La cantidad excede el límite permitido de ${CANTIDAD_MAXIMA} unidades por movimiento`
      );
    }

    return true;
  }

  /**
   * Valida los precios en entradas de inventario
   */
  validarPrecios(precioCompra, precioVenta, precioUnitario) {
    // Validar que el precio unitario esté en un rango razonable
    if (precioUnitario <= 0) {
      throw new Error('El precio unitario debe ser mayor a 0');
    }

    // Advertir si el precio unitario es muy diferente al precio de compra registrado
    if (precioCompra > 0) {
      const diferencia = Math.abs(precioUnitario - precioCompra) / precioCompra;
      if (diferencia > 0.5) {
        // Más de 50% de diferencia
        return {
          warning: true,
          mensaje: `El precio unitario (${precioUnitario}) difiere significativamente del precio de compra registrado (${precioCompra}). Verifica que sea correcto.`
        };
      }
    }

    return { warning: false };
  }

  /**
   * Valida que no haya movimientos duplicados recientes
   */
  async validarNoDuplicado(productoId, cantidad, tipo, minutosVentana = 5) {
    const fechaLimite = new Date(Date.now() - minutosVentana * 60 * 1000);

    const movimientoReciente = await InventoryMovement.findOne({
      producto: productoId,
      cantidad: cantidad,
      tipo: tipo,
      cancelado: false,
      createdAt: { $gte: fechaLimite }
    });

    if (movimientoReciente) {
      throw new Error(
        `Ya existe un movimiento idéntico registrado hace ${minutosVentana} minutos. Si es intencional, espera un momento antes de registrarlo nuevamente.`
      );
    }

    return true;
  }

  /**
   * Valida el motivo del movimiento
   */
  validarMotivo(motivo, tipo) {
    if (!motivo || motivo.trim().length < 5) {
      throw new Error('Debe proporcionar un motivo detallado (mínimo 5 caracteres)');
    }

    // Para ajustes, requerir motivos más detallados
    if (['AJUSTE_ENTRADA', 'AJUSTE_SALIDA'].includes(tipo) && motivo.length < 20) {
      throw new Error(
        'Los ajustes de inventario requieren un motivo más detallado (mínimo 20 caracteres)'
      );
    }

    return true;
  }

  /**
   * Valida datos de entrada de productos
   */
  validarDatosEntrada(datos) {
    const errores = [];

    if (!datos.proveedor || datos.proveedor.trim().length < 3) {
      errores.push('Debe especificar el proveedor (mínimo 3 caracteres)');
    }

    if (!datos.numeroDocumento || datos.numeroDocumento.trim().length === 0) {
      errores.push('Debe especificar el número de documento (factura, remito, etc.)');
    }

    if (!datos.precioUnitario || datos.precioUnitario <= 0) {
      errores.push('Debe especificar un precio unitario válido');
    }

    if (errores.length > 0) {
      throw new Error(`Errores en datos de entrada: ${errores.join(', ')}`);
    }

    return true;
  }

  /**
   * Detecta posibles errores de tipeo en cantidades
   */
  detectarErroresTipeo(cantidad, stockActual, stockPromedio) {
    const advertencias = [];

    // Cantidad es 10x mayor al stock actual
    if (cantidad > stockActual * 10 && stockActual > 0) {
      advertencias.push(
        `La cantidad (${cantidad}) es 10 veces mayor al stock actual (${stockActual}). Verifica que no sea un error.`
      );
    }

    // Cantidad es muy diferente al promedio histórico
    if (stockPromedio > 0 && cantidad > stockPromedio * 5) {
      advertencias.push(
        `La cantidad (${cantidad}) es mucho mayor al promedio histórico (${Math.round(stockPromedio)}). Verifica que sea correcto.`
      );
    }

    // Detectar patrones sospechosos (ej: 111, 222, 999)
    const cantidadStr = cantidad.toString();
    if (cantidadStr.length > 2 && /^(\d)\1+$/.test(cantidadStr)) {
      advertencias.push(
        `La cantidad (${cantidad}) tiene un patrón repetitivo. Verifica que no sea un error de tipeo.`
      );
    }

    return advertencias;
  }

  /**
   * Valida que el stock mínimo no sea violado
   */
  validarStockMinimo(stockNuevo, stockMinimo, nombreProducto) {
    if (stockNuevo < stockMinimo) {
      return {
        alerta: true,
        mensaje: `ADVERTENCIA: El producto "${nombreProducto}" quedará por debajo del stock mínimo. Nuevo stock: ${stockNuevo}, Mínimo: ${stockMinimo}`
      };
    }
    return { alerta: false };
  }

  /**
   * Valida permisos para operaciones críticas
   */
  validarPermisos(usuario, tipo) {
    // Los ajustes solo pueden ser realizados por administradores
    if (['AJUSTE_ENTRADA', 'AJUSTE_SALIDA'].includes(tipo)) {
      if (usuario.rol !== 'admin') {
        throw new Error('Solo los administradores pueden realizar ajustes de inventario');
      }
    }

    return true;
  }

  /**
   * Validación completa para entrada de productos
   */
  async validarEntrada(datos, usuario) {
    const errores = [];
    const advertencias = [];

    try {
      // 1. Validar producto existe
      const producto = await this.validarProductoExistente(datos.producto);

      // 2. Validar cantidad razonable
      this.validarCantidadRazonable(datos.cantidad, 'ENTRADA', producto.stock);

      // 3. Validar datos de entrada
      this.validarDatosEntrada(datos);

      // 4. Validar motivo
      this.validarMotivo(datos.motivo, 'ENTRADA');

      // 5. Validar precios
      const validacionPrecio = this.validarPrecios(
        producto.precioCompra,
        producto.precioVenta,
        datos.precioUnitario
      );
      if (validacionPrecio.warning) {
        advertencias.push(validacionPrecio.mensaje);
      }

      // 6. Detectar errores de tipeo
      const errorestipeo = this.detectarErroresTipeo(
        datos.cantidad,
        producto.stock,
        producto.stock // En producción, usar promedio histórico
      );
      advertencias.push(...errorestipeo);

      return {
        valido: true,
        producto,
        advertencias: advertencias.length > 0 ? advertencias : null
      };
    } catch (error) {
      return {
        valido: false,
        error: error.message
      };
    }
  }

  /**
   * Validación completa para salida de productos
   */
  async validarSalida(datos, usuario) {
    try {
      // 1. Validar producto existe
      const producto = await this.validarProductoExistente(datos.producto);

      // 2. Validar stock local suficiente
      await this.validarStockSuficiente(datos.producto, datos.cantidad);

      // 3. Validar cantidad razonable contra stock local
      this.validarCantidadRazonable(datos.cantidad, 'SALIDA', producto.stockLocal || 0);

      // 4. Validar motivo
      this.validarMotivo(datos.motivo, 'SALIDA');

      // 5. Validar stock mínimo local
      const stockNuevo = (producto.stockLocal || 0) - datos.cantidad;
      const alertaStockMinimo = this.validarStockMinimo(
        stockNuevo,
        producto.stockMinimoLocal || 5,
        producto.nombre
      );

      const advertencias = [];
      if (alertaStockMinimo.alerta) {
        advertencias.push(alertaStockMinimo.mensaje);
      }

      return {
        valido: true,
        producto,
        advertencias: advertencias.length > 0 ? advertencias : null
      };
    } catch (error) {
      return {
        valido: false,
        error: error.message
      };
    }
  }

  /**
   * Validación completa para ajustes de inventario
   */
  async validarAjuste(datos, usuario) {
    try {
      // 1. Validar permisos
      this.validarPermisos(usuario, datos.tipo);

      // 2. Validar producto existe
      const producto = await this.validarProductoExistente(datos.producto);

      // 3. Validar cantidad razonable
      this.validarCantidadRazonable(datos.cantidad, datos.tipo, producto.stock);

      // 4. Validar motivo detallado
      this.validarMotivo(datos.motivo, datos.tipo);

      // 5. Para ajustes de salida, validar stock suficiente
      if (datos.tipo === 'AJUSTE_SALIDA') {
        await this.validarStockSuficiente(datos.producto, datos.cantidad);
      }

      return {
        valido: true,
        producto,
        requiereAprobacion: true,
        advertencias: ['Este ajuste requerirá aprobación de un supervisor']
      };
    } catch (error) {
      return {
        valido: false,
        error: error.message
      };
    }
  }
}

module.exports = new InventoryValidationService();
