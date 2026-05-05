import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const viewRef = useRef(null);

  const [pantalla, setPantalla] = useState('clientes');
  const [clientes, setClientes] = useState([]);
  const [clienteActual, setClienteActual] = useState(null);
  const [clienteCobranzaActual, setClienteCobranzaActual] = useState(null);
  const [creditoActual, setCreditoActual] = useState(null);
  const [comprobanteActual, setComprobanteActual] = useState(null);

  const [nuevoCliente, setNuevoCliente] = useState('');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [editarClienteNombre, setEditarClienteNombre] = useState('');
  const [pagoEditandoRecibo, setPagoEditandoRecibo] = useState(null);
  const [fechaEditable, setFechaEditable] = useState('');
  const [modoCreditoEdicion, setModoCreditoEdicion] = useState(false);
  const [contadorRecibo, setContadorRecibo] = useState(112);
  const [numeroReciboActual, setNumeroReciboActual] = useState('');

  const [credito, setCredito] = useState({
    contrato: '',
    total: '',
    valor: '',
    interesSemanal: '',
    fechaInicio: ''
  });

  const [pago, setPago] = useState({
    monto: '',
    cuota: '',
    concepto: 'Pago crédito semanal'
  });

  const [pagoGeneradoSemanal, setPagoGeneradoSemanal] = useState({
    monto: '',
    semanaId: '',
    semanaLabel: ''
  });

  const [mostrarSelectorSemanas, setMostrarSelectorSemanas] = useState(false);

  const fechaActualRecaudacion = new Date();
  const [mesRecaudacion, setMesRecaudacion] = useState(
    `${fechaActualRecaudacion.getFullYear()}-${String(fechaActualRecaudacion.getMonth() + 1).padStart(2, '0')}`
  );
  const [mostrarSelectorMeses, setMostrarSelectorMeses] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('clientes', JSON.stringify(clientes));
    AsyncStorage.setItem('contadorRecibo', String(contadorRecibo));
  }, [clientes, contadorRecibo]);

  const cargarDatos = async () => {
    const data = await AsyncStorage.getItem('clientes');
    const recibo = await AsyncStorage.getItem('contadorRecibo');

    if (data) {
      const parsed = JSON.parse(data);
      const normalizados = parsed.map(c => ({
        ...c,
        creditos: Array.isArray(c.creditos) ? c.creditos.map(cr => ({
          ...cr,
          interesSemanal: cr.interesSemanal || '',
          fechaInicio: cr.fechaInicio || '',
          pagos: Array.isArray(cr.pagos) ? cr.pagos : [],
          cobranzasSemanal: Array.isArray(cr.cobranzasSemanal) ? cr.cobranzasSemanal : []
        })) : []
      }));
      setClientes(normalizados);

      const mayorRecibo = obtenerMayorNumeroRecibo(normalizados);
      const contadorGuardado = parseInt(recibo, 10) || 112;
      setContadorRecibo(Math.max(contadorGuardado, mayorRecibo + 1));
    } else if (recibo) {
      setContadorRecibo(parseInt(recibo, 10) || 112);
    }
  };

  const numero = (v) => {
    const limpio = String(v || '').replace(/\./g, '').replace(',', '.');
    return parseFloat(limpio) || 0;
  };

  const dinero = (v) => {
    const n = numero(v);
    return '$ ' + Math.round(n || 0).toLocaleString('es-AR');
  };

  const calcularPagoSemanal = (cr) => {
    const valor = numero(cr?.valor);
    const cuotas = parseInt(cr?.total) || 1;
    const interes = numero(cr?.interesSemanal);

    const interesTotal = valor * (interes / 100) * cuotas;
    const totalADevolver = valor + interesTotal;

    return Math.round(totalADevolver / cuotas);
  };

  const obtenerUltimoContratoCliente = (cliente) => {
    const creditos = cliente?.creditos || [];
    if (creditos.length === 0) return '';
    return creditos[creditos.length - 1]?.contrato || '';
  };

  const prepararNuevoCredito = () => {
    const contratoDetectado = obtenerUltimoContratoCliente(clienteActual);

    setCredito({
      contrato: contratoDetectado,
      total: '',
      valor: '',
      interesSemanal: '',
      fechaInicio: ''
    });

    setPantalla('credito');
  };

  const obtenerMayorNumeroRecibo = (listaClientes) => {
    let mayor = 111;

    (listaClientes || []).forEach(cliente => {
      (cliente.creditos || []).forEach(cr => {
        (cr.pagos || []).forEach(p => {
          const recibo = String(p.recibo || '');
          const partes = recibo.split('-');
          const numeroRecibo = parseInt(partes[1], 10);

          if (!isNaN(numeroRecibo) && numeroRecibo > mayor) {
            mayor = numeroRecibo;
          }
        });
      });
    });

    return mayor;
  };

  const obtenerProximoNumeroRecibo = () => {
    const mayorExistente = obtenerMayorNumeroRecibo(clientes);
    const proximo = Math.max(contadorRecibo, mayorExistente + 1);
    return proximo;
  };

  const calcularSaldoAcumulado = (cr) => {
    const pagoEsperado = calcularPagoSemanal(cr);
    let saldo = 0;

    (cr?.pagos || []).forEach(p => {
      const esperado = numero(p.esperado || pagoEsperado);
      const abonado = numero(p.monto);
      saldo = Math.max(0, saldo + esperado - abonado);
    });

    return saldo;
  };

  const calcularSaldoParaPago = (cr, montoAbonado) => {
    const pagoEsperado = calcularPagoSemanal(cr);
    const saldoAnterior = calcularSaldoAcumulado(cr);
    const abonado = numero(montoAbonado);
    const diferenciaSemana = Math.max(0, pagoEsperado - abonado);
    const saldoAcumulado = Math.max(0, saldoAnterior + pagoEsperado - abonado);

    return {
      pagoEsperado,
      saldoAnterior,
      diferenciaSemana,
      saldoAcumulado
    };
  };

  const estaSemana = (fechaISO) => {
    if (!fechaISO) return false;

    const fecha = new Date(fechaISO);
    const hoy = new Date();
    const dia = hoy.getDay();
    const diferenciaAlLunes = dia === 0 ? -6 : 1 - dia;

    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() + diferenciaAlLunes);
    inicioSemana.setHours(0, 0, 0, 0);

    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 7);

    return fecha >= inicioSemana && fecha < finSemana;
  };

  const creditoEstaActivo = (cr) => {
    const pagadas = (cr?.pagos || []).length;
    const totalCuotas = parseInt(cr?.total) || 0;
    return totalCuotas === 0 || pagadas < totalCuotas;
  };

  const calcularCobranzaClienteSemanal = (cliente) => {
    let esperado = 0;
    let generado = 0;

    (cliente?.creditos || []).forEach(cr => {
      if (!creditoEstaActivo(cr)) return;

      esperado += calcularPagoSemanal(cr);

      (cr.cobranzasSemanal || []).forEach(cobranza => {
        if (estaSemana(cobranza.fechaISO)) {
          generado += numero(cobranza.monto);
        }
      });
    });

    const morosidad = esperado > 0
      ? Math.max(0, ((esperado - generado) / esperado) * 100)
      : 0;

    const cobranza = esperado > 0
      ? Math.min(100, (generado / esperado) * 100)
      : 0;

    return { esperado, generado, morosidad, cobranza };
  };

  const calcularCobranzaGeneralSemanal = () => {
    let esperado = 0;
    let generado = 0;

    clientes.forEach(cliente => {
      const resumen = calcularCobranzaClienteSemanal(cliente);
      esperado += resumen.esperado;
      generado += resumen.generado;
    });

    const morosidad = esperado > 0
      ? Math.max(0, ((esperado - generado) / esperado) * 100)
      : 0;

    const cobranza = esperado > 0
      ? Math.min(100, (generado / esperado) * 100)
      : 0;

    return { esperado, generado, morosidad, cobranza };
  };


  const obtenerSemanasCliente = (cliente) => {
    const semanas = {};

    (cliente?.creditos || []).forEach(cr => {
      (cr.cobranzasSemanal || []).forEach(registro => {
        if (!registro.semanaId) return;

        semanas[registro.semanaId] = {
          id: registro.semanaId,
          label: registro.semanaLabel || registro.semanaId,
          inicioISO: registro.semanaInicioISO || '',
          finISO: registro.semanaFinISO || ''
        };
      });
    });

    return Object.values(semanas).sort((a, b) => a.id.localeCompare(b.id));
  };

  const calcularCobranzasPorSemanaCliente = (cliente) => {
    const semanas = obtenerSemanasCliente(cliente);

    return semanas.map(semana => {
      let esperado = 0;
      let generado = 0;

      (cliente?.creditos || []).forEach(cr => {
        if (!creditoEstaActivo(cr)) return;

        esperado += calcularPagoSemanal(cr);

        (cr.cobranzasSemanal || []).forEach(registro => {
          if (registro.semanaId === semana.id) {
            generado += numero(registro.monto);
          }
        });
      });

      const cobranza = esperado > 0
        ? Math.min(100, (generado / esperado) * 100)
        : 0;

      const morosidad = esperado > 0
        ? Math.max(0, ((esperado - generado) / esperado) * 100)
        : 0;

      return {
        ...semana,
        esperado,
        generado,
        cobranza,
        morosidad
      };
    });
  };

  const calcularCobranzaHistoricaCliente = (cliente) => {
    const semanas = calcularCobranzasPorSemanaCliente(cliente);

    let esperado = 0;
    let generado = 0;

    semanas.forEach(semana => {
      esperado += semana.esperado;
      generado += semana.generado;
    });

    const cobranza = esperado > 0
      ? Math.min(100, (generado / esperado) * 100)
      : 0;

    const morosidad = esperado > 0
      ? Math.max(0, ((esperado - generado) / esperado) * 100)
      : 0;

    return { esperado, generado, cobranza, morosidad, semanasAnalizadas: semanas.length };
  };

  const calcularCobranzaHistoricaGeneral = () => {
    let esperado = 0;
    let generado = 0;

    clientes.forEach(cliente => {
      const resumen = calcularCobranzaHistoricaCliente(cliente);
      esperado += resumen.esperado;
      generado += resumen.generado;
    });

    const cobranza = esperado > 0
      ? Math.min(100, (generado / esperado) * 100)
      : 0;

    const morosidad = esperado > 0
      ? Math.max(0, ((esperado - generado) / esperado) * 100)
      : 0;

    return { esperado, generado, cobranza, morosidad };
  };

  const abrirCobranzasCliente = (cliente) => {
    setClienteCobranzaActual(cliente);
    setPantalla('cobranzasCliente');
  };


  const obtenerMesesRecaudacion = () => {
    const anioActual = new Date().getFullYear();
    const opciones = [];

    for (let anio = anioActual - 1; anio <= anioActual + 1; anio++) {
      for (let mes = 1; mes <= 12; mes++) {
        opciones.push({
          id: `${anio}-${String(mes).padStart(2, '0')}`,
          label: `${meses[mes - 1]} ${anio}`,
          anio,
          mes
        });
      }
    }

    return opciones;
  };

  const obtenerLabelMesRecaudacion = () => {
    const encontrado = obtenerMesesRecaudacion().find(m => m.id === mesRecaudacion);
    return encontrado ? encontrado.label : mesRecaudacion;
  };

  const obtenerSemanasPorMesId = (mesId) => {
    const [anioTexto, mesTexto] = String(mesId).split('-');
    const anio = parseInt(anioTexto, 10);
    const mes = parseInt(mesTexto, 10);
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const semanas = [];

    for (let inicioDia = 1; inicioDia <= ultimoDia; inicioDia += 7) {
      const semanaMes = Math.ceil(inicioDia / 7);
      const finDia = Math.min(inicioDia + 6, ultimoDia);
      const inicio = new Date(anio, mes - 1, inicioDia);
      const fin = new Date(anio, mes - 1, finDia);

      semanas.push({
        id: `${anio}-${String(mes).padStart(2, '0')}-${semanaMes}`,
        label: `Semana ${semanaMes} - ${meses[mes - 1]} ${anio} (${formatearFechaCorta(inicio)} al ${formatearFechaCorta(fin)})`,
        inicioISO: inicio.toISOString(),
        finISO: fin.toISOString()
      });
    }

    return semanas;
  };

  const obtenerSemanaParaGrafico = (mesId) => {
    const semanasMes = obtenerSemanasPorMesId(mesId);
    const semanasConRegistro = new Set();

    clientes.forEach(cliente => {
      (cliente.creditos || []).forEach(cr => {
        (cr.cobranzasSemanal || []).forEach(registro => {
          if (String(registro.semanaId || '').startsWith(mesId)) {
            semanasConRegistro.add(registro.semanaId);
          }
        });
      });
    });

    const conRegistro = semanasMes.filter(s => semanasConRegistro.has(s.id));
    if (conRegistro.length > 0) return conRegistro[conRegistro.length - 1];

    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    if (mesActual === mesId) {
      const semanaActual = Math.ceil(hoy.getDate() / 7);
      return semanasMes.find(s => s.id.endsWith(`-${semanaActual}`)) || semanasMes[0];
    }

    return semanasMes[0];
  };

  const calcularEsperadoSemanalGeneral = () => {
    let esperado = 0;

    clientes.forEach(cliente => {
      (cliente.creditos || []).forEach(cr => {
        if (creditoEstaActivo(cr)) {
          esperado += calcularPagoSemanal(cr);
        }
      });
    });

    return esperado;
  };

  const calcularRecaudacionSemanaGeneral = (mesId) => {
    const semana = obtenerSemanaParaGrafico(mesId);
    const esperado = calcularEsperadoSemanalGeneral();
    let recaudado = 0;

    clientes.forEach(cliente => {
      (cliente.creditos || []).forEach(cr => {
        (cr.cobranzasSemanal || []).forEach(registro => {
          if (registro.semanaId === semana?.id) {
            recaudado += numero(registro.monto);
          }
        });
      });
    });

    const saldo = Math.max(0, esperado - recaudado);
    const porcentajeRecaudado = esperado > 0 ? Math.min(100, (recaudado / esperado) * 100) : 0;
    const porcentajeSaldo = esperado > 0 ? Math.max(0, (saldo / esperado) * 100) : 0;

    return {
      label: semana?.label || 'Semana no disponible',
      esperado,
      recaudado,
      saldo,
      porcentajeRecaudado,
      porcentajeSaldo
    };
  };

  const calcularRecaudacionMensualGeneral = (mesId) => {
    const semanasMes = obtenerSemanasPorMesId(mesId);
    const esperadoMensual = calcularEsperadoSemanalGeneral() * semanasMes.length;
    let recaudado = 0;

    clientes.forEach(cliente => {
      (cliente.creditos || []).forEach(cr => {
        (cr.cobranzasSemanal || []).forEach(registro => {
          if (String(registro.semanaId || '').startsWith(mesId)) {
            recaudado += numero(registro.monto);
          }
        });
      });
    });

    const saldo = Math.max(0, esperadoMensual - recaudado);
    const porcentajeRecaudado = esperadoMensual > 0 ? Math.min(100, (recaudado / esperadoMensual) * 100) : 0;
    const porcentajeSaldo = esperadoMensual > 0 ? Math.max(0, (saldo / esperadoMensual) * 100) : 0;

    return {
      label: obtenerLabelMesRecaudacion(),
      esperado: esperadoMensual,
      recaudado,
      saldo,
      porcentajeRecaudado,
      porcentajeSaldo
    };
  };

  const GraficoTortaRecaudacion = ({
    titulo,
    labelRecaudado,
    labelSaldo,
    recaudado,
    saldo,
    porcentajeRecaudado,
    porcentajeSaldo
  }) => (
    <View style={styles.item}>
      <Text style={styles.itemTitle}>{titulo}</Text>

      <View style={styles.pieRow}>
        <View style={styles.pieCircle}>
          <Text style={styles.piePercent}>{porcentajeRecaudado.toFixed(1)}%</Text>
          <Text style={styles.pieText}>cobranza</Text>
        </View>

        <View style={styles.pieLegend}>
          <View style={styles.legendRow}>
            <View style={styles.legendColorRecaudado} />
            <Text>{labelRecaudado}: {dinero(recaudado)}</Text>
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendColorSaldo} />
            <Text>{labelSaldo}: {dinero(saldo)}</Text>
          </View>

          <Text>Porcentaje recaudado: {porcentajeRecaudado.toFixed(1)}%</Text>
          <Text>Porcentaje saldo: {porcentajeSaldo.toFixed(1)}%</Text>
        </View>
      </View>
    </View>
  );

  const actualizarActuales = (lista, clienteId, creditoId = null) => {
    const clienteNuevo = lista.find(c => c.id === clienteId);
    setClienteActual(clienteNuevo || null);

    if (creditoId && clienteNuevo) {
      const creditoNuevo = clienteNuevo.creditos.find(cr => cr.id === creditoId);
      setCreditoActual(creditoNuevo || null);
    }
  };

  const agregarCliente = () => {
    if (!nuevoCliente.trim()) return;

    const nuevo = {
      id: Date.now().toString(),
      nombre: nuevoCliente.trim(),
      creditos: []
    };

    setClientes([...clientes, nuevo]);
    setNuevoCliente('');
    setBusquedaCliente('');
  };


  const recalcularPagosCredito = (cr, pagos) => {
    const pagoEsperado = calcularPagoSemanal(cr);
    let saldoAnterior = 0;

    return (pagos || []).map(p => {
      const abonado = numero(p.monto);
      const diferenciaSemana = Math.max(0, pagoEsperado - abonado);
      const saldoAcumulado = Math.max(0, saldoAnterior + pagoEsperado - abonado);

      const actualizado = {
        ...p,
        esperado: String(pagoEsperado),
        saldoAnterior: String(saldoAnterior),
        saldoSemana: String(diferenciaSemana),
        saldoAcumulado: String(saldoAcumulado)
      };

      saldoAnterior = saldoAcumulado;
      return actualizado;
    });
  };

  const prepararEditarCliente = () => {
    setEditarClienteNombre(clienteActual?.nombre || '');
    setPantalla('editarCliente');
  };

  const guardarEdicionCliente = () => {
    if (!editarClienteNombre.trim()) {
      Alert.alert('Falta dato', 'Ingresá el nombre del cliente.');
      return;
    }

    const lista = clientes.map(c => {
      if (c.id === clienteActual.id) {
        return { ...c, nombre: editarClienteNombre.trim() };
      }
      return c;
    });

    setClientes(lista);
    actualizarActuales(lista, clienteActual.id, creditoActual?.id);
    setPantalla('detalleCliente');
  };

  const prepararEditarCredito = () => {
    setModoCreditoEdicion(true);
    setCredito({
      contrato: creditoActual?.contrato || '',
      total: String(creditoActual?.total || ''),
      valor: String(creditoActual?.valor || ''),
      interesSemanal: String(creditoActual?.interesSemanal || ''),
      fechaInicio: creditoActual?.fechaInicio || ''
    });
    setPantalla('editarCredito');
  };

  const guardarEdicionCredito = () => {
    if (!credito.contrato || !credito.total || !credito.valor || !credito.interesSemanal || !credito.fechaInicio) {
      Alert.alert('Faltan datos', 'Completá contrato, cuotas, valor del crédito, interés semanal y fecha de inicio.');
      return;
    }

    const lista = clientes.map(c => {
      if (c.id === clienteActual.id) {
        return {
          ...c,
          creditos: (c.creditos || []).map(cr => {
            if (cr.id === creditoActual.id) {
              const creditoActualizado = {
                ...cr,
                contrato: credito.contrato,
                total: credito.total,
                valor: credito.valor,
                interesSemanal: credito.interesSemanal,
                fechaInicio: credito.fechaInicio
              };

              return {
                ...creditoActualizado,
                pagos: recalcularPagosCredito(creditoActualizado, creditoActualizado.pagos || [])
              };
            }
            return cr;
          })
        };
      }
      return c;
    });

    setClientes(lista);
    actualizarActuales(lista, clienteActual.id, creditoActual.id);
    setModoCreditoEdicion(false);
    setCredito({ contrato: '', total: '', valor: '', interesSemanal: '', fechaInicio: '' });
    setPantalla('detalleCredito');
  };

  const prepararEditarPago = (pagoGuardado) => {
    setPagoEditandoRecibo(pagoGuardado.recibo);
    setPago({
      monto: String(pagoGuardado.monto || ''),
      cuota: String(pagoGuardado.cuota || ''),
      concepto: pagoGuardado.concepto || 'Pago crédito semanal'
    });
    setFechaEditable(pagoGuardado.fecha || '');
    setPantalla('editarPago');
  };

  const guardarEdicionPago = () => {
    if (!pago.monto) {
      Alert.alert('Falta el monto', 'Ingresá el monto abonado.');
      return;
    }

    let pagoActualizadoParaVer = null;

    const lista = clientes.map(c => {
      if (c.id === clienteActual.id) {
        return {
          ...c,
          creditos: (c.creditos || []).map(cr => {
            if (cr.id === creditoActual.id) {
              const pagosEditados = (cr.pagos || []).map(pGuardado => {
                if (pGuardado.recibo === pagoEditandoRecibo) {
                  return {
                    ...pGuardado,
                    monto: pago.monto,
                    cuota: pago.cuota,
                    concepto: pago.concepto,
                    fecha: fechaEditable
                  };
                }
                return pGuardado;
              });

              const pagosRecalculados = recalcularPagosCredito(cr, pagosEditados);
              pagoActualizadoParaVer = pagosRecalculados.find(p => p.recibo === pagoEditandoRecibo) || null;

              return {
                ...cr,
                pagos: pagosRecalculados
              };
            }
            return cr;
          })
        };
      }
      return c;
    });

    setClientes(lista);
    actualizarActuales(lista, clienteActual.id, creditoActual.id);
    if (pagoActualizadoParaVer) {
      setPago(pagoActualizadoParaVer);
      setNumeroReciboActual(pagoActualizadoParaVer.recibo);
      setComprobanteActual(pagoActualizadoParaVer);
    }
    setPagoEditandoRecibo(null);
    setFechaEditable('');
    setPantalla('detalleCredito');
  };

  const eliminarCliente = (clienteId) => {
    Alert.alert(
      'Eliminar cliente',
      '¿Seguro que querés eliminar este cliente y todos sus créditos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setClientes(clientes.filter(c => c.id !== clienteId));
            setPantalla('clientes');
          }
        }
      ]
    );
  };

  const eliminarCredito = (creditoId) => {
    Alert.alert(
      'Eliminar crédito',
      '¿Seguro que querés eliminar este crédito?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const lista = clientes.map(c => {
              if (c.id === clienteActual.id) {
                return {
                  ...c,
                  creditos: c.creditos.filter(cr => cr.id !== creditoId)
                };
              }
              return c;
            });

            setClientes(lista);
            actualizarActuales(lista, clienteActual.id);
            setPantalla('detalleCliente');
          }
        }
      ]
    );
  };

  const eliminarPago = (recibo) => {
    Alert.alert(
      'Eliminar comprobante',
      '¿Seguro que querés eliminar este comprobante?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const lista = clientes.map(c => {
              if (c.id === clienteActual.id) {
                return {
                  ...c,
                  creditos: c.creditos.map(cr => {
                    if (cr.id === creditoActual.id) {
                      return {
                        ...cr,
                        pagos: cr.pagos.filter(p => p.recibo !== recibo)
                      };
                    }
                    return cr;
                  })
                };
              }
              return c;
            });

            setClientes(lista);
            actualizarActuales(lista, clienteActual.id, creditoActual.id);
            setPantalla('detalleCredito');
          }
        }
      ]
    );
  };

  const abrirCliente = (cliente) => {
    setClienteActual(cliente);
    setPantalla('detalleCliente');
  };

  const guardarCredito = () => {
    if (!credito.contrato || !credito.total || !credito.valor || !credito.interesSemanal || !credito.fechaInicio) {
      Alert.alert('Faltan datos', 'Completá contrato, cuotas, valor del crédito, interés semanal y fecha de inicio.');
      return;
    }

    const nuevoCredito = {
      id: Date.now().toString(),
      contrato: credito.contrato,
      total: credito.total,
      valor: credito.valor,
      interesSemanal: credito.interesSemanal,
      fechaInicio: credito.fechaInicio,
      pagos: [],
      cobranzasSemanal: []
    };

    const lista = clientes.map(c => {
      if (c.id === clienteActual.id) {
        return {
          ...c,
          creditos: [...(c.creditos || []), nuevoCredito]
        };
      }
      return c;
    });

    setClientes(lista);
    actualizarActuales(lista, clienteActual.id, nuevoCredito.id);
    setCredito({ contrato: '', total: '', valor: '', interesSemanal: '', fechaInicio: '' });

    setPago({
      monto: String(calcularPagoSemanal(nuevoCredito)),
      cuota: '1',
      concepto: 'Pago crédito semanal'
    });

    setPantalla('pago');
  };

  const seleccionarCredito = (cred) => {
    const pagos = Array.isArray(cred.pagos) ? cred.pagos : [];
    setCreditoActual({ ...cred, pagos });
    setPantalla('detalleCredito');
  };

  const irANuevoPago = () => {
    const pagos = creditoActual?.pagos || [];
    const totalCuotas = parseInt(creditoActual?.total) || 0;

    if (pagos.length >= totalCuotas) {
      Alert.alert('Crédito cancelado', 'Este crédito ya fue cancelado.');
      return;
    }

    setPago({
      monto: String(calcularPagoSemanal(creditoActual)),
      cuota: String(pagos.length + 1),
      concepto: 'Pago crédito semanal'
    });

    setPantalla('pago');
  };


  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const formatearFechaCorta = (fecha) => {
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  };

  const obtenerSemanasDelAnio = () => {
    const anio = new Date().getFullYear();
    const semanas = [];

    for (let mes = 0; mes < 12; mes++) {
      const ultimoDia = new Date(anio, mes + 1, 0).getDate();
      let semanaMes = 1;

      for (let inicioDia = 1; inicioDia <= ultimoDia; inicioDia += 7) {
        const finDia = Math.min(inicioDia + 6, ultimoDia);
        const inicio = new Date(anio, mes, inicioDia);
        const fin = new Date(anio, mes, finDia);

        semanas.push({
          id: `${anio}-${String(mes + 1).padStart(2, '0')}-${semanaMes}`,
          label: `Semana ${semanaMes} - ${meses[mes]} ${anio} (${formatearFechaCorta(inicio)} al ${formatearFechaCorta(fin)})`,
          anio,
          mes: mes + 1,
          semanaMes,
          inicioISO: inicio.toISOString(),
          finISO: fin.toISOString()
        });

        semanaMes += 1;
      }
    }

    return semanas;
  };

  const obtenerSemanaActual = () => {
    const hoy = new Date();
    const dia = hoy.getDate();
    const semanaMes = Math.ceil(dia / 7);
    const inicioDia = ((semanaMes - 1) * 7) + 1;
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const finDia = Math.min(inicioDia + 6, ultimoDia);
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), inicioDia);
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), finDia);

    return {
      id: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${semanaMes}`,
      label: `Semana ${semanaMes} - ${meses[hoy.getMonth()]} ${hoy.getFullYear()} (${formatearFechaCorta(inicio)} al ${formatearFechaCorta(fin)})`,
      anio: hoy.getFullYear(),
      mes: hoy.getMonth() + 1,
      semanaMes,
      inicioISO: inicio.toISOString(),
      finISO: fin.toISOString()
    };
  };

  const seleccionarSemanaPagoGenerado = (semana) => {
    setPagoGeneradoSemanal({
      ...pagoGeneradoSemanal,
      semanaId: semana.id,
      semanaLabel: semana.label,
      semanaInicioISO: semana.inicioISO,
      semanaFinISO: semana.finISO
    });
    setMostrarSelectorSemanas(false);
  };

  const irAPagoGeneradoSemanal = () => {
    if (!creditoActual || !creditoEstaActivo(creditoActual)) {
      Alert.alert('Crédito cancelado', 'Este crédito ya fue cancelado.');
      return;
    }

    const semanaActual = obtenerSemanaActual();

    setPagoGeneradoSemanal({
      monto: '',
      semanaId: semanaActual.id,
      semanaLabel: semanaActual.label,
      semanaInicioISO: semanaActual.inicioISO,
      semanaFinISO: semanaActual.finISO
    });

    setMostrarSelectorSemanas(false);
    setPantalla('pagoGeneradoSemanal');
  };

  const guardarPagoGeneradoSemanal = () => {
    if (!pagoGeneradoSemanal.semanaId) {
      Alert.alert('Falta dato', 'Seleccioná la semana correspondiente.');
      return;
    }

    if (!pagoGeneradoSemanal.monto) {
      Alert.alert('Falta dato', 'Completá el pago generado semanal.');
      return;
    }

    const nuevoRegistro = {
      id: Date.now().toString(),
      monto: pagoGeneradoSemanal.monto,
      esperado: String(calcularPagoSemanal(creditoActual)),
      semanaId: pagoGeneradoSemanal.semanaId,
      semanaLabel: pagoGeneradoSemanal.semanaLabel,
      semanaInicioISO: pagoGeneradoSemanal.semanaInicioISO,
      semanaFinISO: pagoGeneradoSemanal.semanaFinISO,
      fecha: new Date().toLocaleString(),
      fechaISO: new Date().toISOString()
    };

    const lista = clientes.map(c => {
      if (c.id === clienteActual.id) {
        return {
          ...c,
          creditos: (c.creditos || []).map(cr => {
            if (cr.id === creditoActual.id) {
              return {
                ...cr,
                cobranzasSemanal: [...(cr.cobranzasSemanal || []), nuevoRegistro]
              };
            }
            return cr;
          })
        };
      }
      return c;
    });

    setClientes(lista);
    actualizarActuales(lista, clienteActual.id, creditoActual.id);
    setPagoGeneradoSemanal({ monto: '', semanaId: '', semanaLabel: '' });
    setMostrarSelectorSemanas(false);
    setPantalla('detalleCredito');
  };

  const generarComprobante = () => {
    if (!pago.monto) {
      Alert.alert('Falta el monto', 'Ingresá el monto abonado.');
      return;
    }

    const proximoRecibo = obtenerProximoNumeroRecibo();
    const nro = `001-${String(proximoRecibo).padStart(6, '0')}`;
    setNumeroReciboActual(nro);
    setContadorRecibo(proximoRecibo + 1);

    const saldoPago = calcularSaldoParaPago(creditoActual, pago.monto);

    const pagoNuevo = {
      ...pago,
      recibo: nro,
      fecha: new Date().toLocaleString(),
      esperado: String(saldoPago.pagoEsperado),
      saldoAnterior: String(saldoPago.saldoAnterior),
      saldoSemana: String(saldoPago.diferenciaSemana),
      saldoAcumulado: String(saldoPago.saldoAcumulado)
    };

    const lista = clientes.map(c => {
      if (c.id === clienteActual.id) {
        return {
          ...c,
          creditos: (c.creditos || []).map(cr => {
            if (cr.id === creditoActual.id) {
              return {
                ...cr,
                pagos: [...(cr.pagos || []), pagoNuevo]
              };
            }
            return cr;
          })
        };
      }
      return c;
    });

    setClientes(lista);
    actualizarActuales(lista, clienteActual.id, creditoActual.id);
    setComprobanteActual(pagoNuevo);
    setPantalla('comprobante');
  };

  const verComprobante = (pagoGuardado) => {
    setPago(pagoGuardado);
    setNumeroReciboActual(pagoGuardado.recibo);
    setComprobanteActual(pagoGuardado);
    setPantalla('comprobante');
  };

  const compartir = async () => {
    try {
      const uri = await captureRef(viewRef.current, {
        format: 'png',
        quality: 1,
      });
      await Sharing.shareAsync(uri);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };


  const obtenerEstadoCliente = (cliente) => {
    const creditos = cliente?.creditos || [];
    const activos = creditos.filter(cr => creditoEstaActivo(cr));

    if (creditos.length === 0) {
      return { texto: 'Sin créditos', color: '#64748b' };
    }

    if (activos.length === 0) {
      return { texto: 'Crédito cancelado', color: '#16a34a' };
    }

    const { morosidad } = calcularCobranzaClienteSemanal(cliente);

    if (morosidad === 0) {
      return { texto: 'Al día', color: '#16a34a' };
    }

    if (morosidad < 50) {
      return { texto: 'Atrasado leve', color: '#f59e0b' };
    }

    return { texto: 'Moroso', color: '#dc2626' };
  };

  const clientesFiltrados = clientes.filter((c) =>
    String(c.nombre || '').toLowerCase().includes(busquedaCliente.trim().toLowerCase())
  );

  const total = parseInt(creditoActual?.total) || 0;
  const abonadas = parseInt(pago.cuota) || 0;
  const restantes = total - abonadas;
  const saldoComprobanteActual = numero(comprobanteActual?.saldoAcumulado || 0);
  const creditoCancelado = restantes <= 0 && saldoComprobanteActual <= 0;

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >

      {pantalla === 'clientes' && (
        <>
          <Text style={styles.title}>FHZ CRÉDITOS</Text>

          <TextInput
            placeholder="Buscar cliente"
            placeholderTextColor="#666"
            style={styles.input}
            value={busquedaCliente}
            onChangeText={setBusquedaCliente}
          />

          <TouchableOpacity style={styles.button} onPress={() => setPantalla('cobranzas')}>
            <Text style={styles.btnText}>Cobranzas</Text>
          </TouchableOpacity>

          {clientesFiltrados.length === 0 && busquedaCliente.trim() !== '' && (
            <View style={styles.item}>
              <Text>No se encontraron clientes con ese nombre.</Text>
            </View>
          )}

          {clientesFiltrados.map((c) => {
            const estado = obtenerEstadoCliente(c);

            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.item,
                  styles.clienteEstadoItem,
                  { borderLeftColor: estado.color }
                ]}
                onPress={() => abrirCliente(c)}
                onLongPress={() => eliminarCliente(c.id)}
              >
                <View style={styles.clienteHeaderRow}>
                  <Text style={styles.itemTitle}>{c.nombre}</Text>
                  <View style={[styles.estadoBadge, { backgroundColor: estado.color }]}>
                    <Text style={styles.estadoBadgeText}>{estado.texto}</Text>
                  </View>
                </View>
                <Text>Créditos: {(c.creditos || []).length}</Text>
                <Text style={styles.hint}>Mantener presionado para eliminar</Text>
              </TouchableOpacity>
            );
          })}

          <TextInput
            placeholder="Nombre del cliente"
            placeholderTextColor="#666"
            style={styles.input}
            value={nuevoCliente}
            onChangeText={setNuevoCliente}
          />

          <TouchableOpacity style={styles.button} onPress={agregarCliente}>
            <Text style={styles.btnText}>Agregar cliente</Text>
          </TouchableOpacity>
        </>
      )}

      {pantalla === 'detalleCliente' && (
        <>
          <Text style={styles.title}>{clienteActual?.nombre}</Text>

          <TouchableOpacity style={styles.buttonSec} onPress={prepararEditarCliente}>
            <Text>Editar cliente</Text>
          </TouchableOpacity>

          {(clienteActual?.creditos || []).map((cr) => {
            const pagos = cr.pagos || [];
            const pagadas = pagos.length;
            const totalCuotas = parseInt(cr.total) || 0;
            const quedan = totalCuotas - pagadas;
            const cancelado = quedan <= 0;

            return (
              <TouchableOpacity
                key={cr.id}
                style={[styles.item, cancelado && styles.creditoCancelado]}
                onPress={() => seleccionarCredito(cr)}
                onLongPress={() => eliminarCredito(cr.id)}
              >
                <Text style={styles.itemTitle}>{cr.contrato}</Text>
                <Text>Valor crédito: ${cr.valor}</Text>
                <Text>Interés semanal: {cr.interesSemanal}%</Text>
                <Text>Pago semanal: ${calcularPagoSemanal(cr).toLocaleString('es-AR')}</Text>
                <Text>{pagadas} de {cr.total}</Text>
                <Text>{cancelado ? 'CRÉDITO CANCELADO' : `Cuotas restantes: ${quedan}`}</Text>
                <Text style={styles.hint}>Mantener presionado para eliminar</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.button} onPress={prepararNuevoCredito}>
            <Text style={styles.btnText}>Nuevo crédito</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.buttonSec} onPress={() => setPantalla('clientes')}>
            <Text>Volver</Text>
          </TouchableOpacity>
        </>
      )}

      {pantalla === 'detalleCredito' && (
        <>
          <Text style={styles.title}>Crédito</Text>

          <View style={[
            styles.item,
            ((creditoActual?.pagos || []).length >= parseInt(creditoActual?.total || 0)) && styles.creditoCancelado
          ]}>
            <Text style={styles.itemTitle}>{creditoActual?.contrato}</Text>
            <Text>Cliente: {clienteActual?.nombre}</Text>
            <Text>Valor crédito: ${creditoActual?.valor}</Text>
            <Text>Interés semanal: {creditoActual?.interesSemanal}%</Text>
            <Text>Pago semanal: ${calcularPagoSemanal(creditoActual).toLocaleString('es-AR')}</Text>
            <Text>Cuotas: {(creditoActual?.pagos || []).length} de {creditoActual?.total}</Text>
            <Text>
              {(creditoActual?.pagos || []).length >= parseInt(creditoActual?.total || 0)
                ? 'CRÉDITO CANCELADO'
                : `Restantes: ${(parseInt(creditoActual?.total) || 0) - (creditoActual?.pagos || []).length}`}
            </Text>
          </View>

          <TouchableOpacity style={styles.buttonSec} onPress={prepararEditarCredito}>
            <Text>Editar crédito</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={irANuevoPago}>
            <Text style={styles.btnText}>Nuevo pago</Text>
          </TouchableOpacity>

          {creditoEstaActivo(creditoActual) && (
            <TouchableOpacity style={styles.button} onPress={irAPagoGeneradoSemanal}>
              <Text style={styles.btnText}>Pago generado semanal</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.subTitle}>Comprobantes creados</Text>

          {(creditoActual?.pagos || []).map((p, i) => (
            <TouchableOpacity
              key={i}
              style={styles.item}
              onPress={() => verComprobante(p)}
              onLongPress={() => eliminarPago(p.recibo)}
            >
              <Text style={styles.itemTitle}>Recibo {p.recibo}</Text>
              <Text>Monto: ${p.monto}</Text>
              <Text>Saldo acumulado: {dinero(p.saldoAcumulado || 0)}</Text>
              <Text>Cuota: {p.cuota} de {creditoActual?.total}</Text>
              <Text>{p.fecha}</Text>
              <TouchableOpacity style={styles.miniButton} onPress={() => prepararEditarPago(p)}>
                <Text style={styles.miniButtonText}>Editar pago</Text>
              </TouchableOpacity>
              <Text style={styles.hint}>Mantener presionado para eliminar</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.buttonSec} onPress={() => setPantalla('detalleCliente')}>
            <Text>Volver al cliente</Text>
          </TouchableOpacity>
        </>
      )}


      {pantalla === 'editarCliente' && (
        <>
          <Text style={styles.title}>Editar cliente</Text>

          <TextInput
            placeholder="Nombre del cliente"
            placeholderTextColor="#666"
            style={styles.input}
            value={editarClienteNombre}
            onChangeText={setEditarClienteNombre}
          />

          <TouchableOpacity style={styles.button} onPress={guardarEdicionCliente}>
            <Text style={styles.btnText}>Guardar cambios</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.buttonSec} onPress={() => setPantalla('detalleCliente')}>
            <Text>Cancelar</Text>
          </TouchableOpacity>
        </>
      )}

      {pantalla === 'editarCredito' && (
        <>
          <Text style={styles.title}>Editar crédito</Text>

          <TextInput
            placeholder="Contrato"
            placeholderTextColor="#666"
            style={styles.input}
            value={credito.contrato}
            onChangeText={(v) => setCredito({ ...credito, contrato: v })}
          />

          <TextInput
            placeholder="Total cuotas"
            placeholderTextColor="#666"
            style={styles.input}
            keyboardType="numeric"
            value={credito.total}
            onChangeText={(v) => setCredito({ ...credito, total: v })}
          />

          <TextInput
            placeholder="Valor crédito"
            placeholderTextColor="#666"
            style={styles.input}
            keyboardType="number-pad"
            value={credito.valor}
            onChangeText={(v) => setCredito({ ...credito, valor: v })}
          />

          <TextInput
            placeholder="Interés semanal (%)"
            placeholderTextColor="#666"
            style={styles.input}
            keyboardType="numeric"
            value={credito.interesSemanal}
            onChangeText={(v) => setCredito({ ...credito, interesSemanal: v })}
          />

          <TextInput
            placeholder="Fecha inicio crédito (DD/MM/AAAA)"
            placeholderTextColor="#666"
            style={styles.input}
            value={credito.fechaInicio}
            onChangeText={(v) => setCredito({ ...credito, fechaInicio: v })}
          />

          <View style={styles.item}>
            <Text>Pago semanal recalculado: ${calcularPagoSemanal(credito).toLocaleString('es-AR')}</Text>
            <Text style={styles.hint}>Al guardar, se recalculan los saldos de los pagos ya creados.</Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={guardarEdicionCredito}>
            <Text style={styles.btnText}>Guardar cambios</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.buttonSec} onPress={() => {
            setModoCreditoEdicion(false);
            setCredito({ contrato: '', total: '', valor: '', interesSemanal: '', fechaInicio: '' });
            setPantalla('detalleCredito');
          }}>
            <Text>Cancelar</Text>
          </TouchableOpacity>
        </>
      )}

      {pantalla === 'editarPago' && (
        <>
          <Text style={styles.title}>Editar pago</Text>

          <View style={styles.item}>
            <Text>Cliente: {clienteActual?.nombre}</Text>
            <Text>Contrato: {creditoActual?.contrato}</Text>
            <Text>Recibo: {pagoEditandoRecibo}</Text>
            <Text>Pago semanal calculado: ${calcularPagoSemanal(creditoActual).toLocaleString('es-AR')}</Text>
          </View>

          <TextInput
            placeholder="Monto abonado"
            placeholderTextColor="#666"
            style={styles.input}
            keyboardType="number-pad"
            value={pago.monto}
            onChangeText={(v) => setPago({ ...pago, monto: v })}
          />

          <TextInput
            placeholder="Número de cuota"
            placeholderTextColor="#666"
            style={styles.input}
            keyboardType="numeric"
            value={pago.cuota}
            onChangeText={(v) => setPago({ ...pago, cuota: v })}
          />

          <TextInput
            placeholder="Fecha y hora de pago"
            placeholderTextColor="#666"
            style={styles.input}
            value={fechaEditable}
            onChangeText={setFechaEditable}
          />

          <TouchableOpacity
            style={styles.input}
            onPress={() =>
              setPago({
                ...pago,
                concepto:
                  pago.concepto === 'Pago crédito semanal'
                    ? 'Pago crédito mensual'
                    : 'Pago crédito semanal'
              })
            }
          >
            <Text>{pago.concepto}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={guardarEdicionPago}>
            <Text style={styles.btnText}>Guardar cambios</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.buttonSec} onPress={() => setPantalla('detalleCredito')}>
            <Text>Cancelar</Text>
          </TouchableOpacity>
        </>
      )}

      {pantalla === 'credito' && (
        <>
          <Text style={styles.title}>Nuevo crédito</Text>

          <TextInput
            placeholder="Contrato"
            placeholderTextColor="#666"
            style={styles.input}
            value={credito.contrato}
            onChangeText={(v) => setCredito({ ...credito, contrato: v })}
          />

          <TextInput
            placeholder="Total cuotas"
            placeholderTextColor="#666"
            style={styles.input}
            keyboardType="numeric"
            value={credito.total}
            onChangeText={(v) => setCredito({ ...credito, total: v })}
          />

          <TextInput
            placeholder="Valor crédito"
            placeholderTextColor="#666"
            style={styles.input}
            keyboardType="number-pad"
            value={credito.valor}
            onChangeText={(v) => setCredito({ ...credito, valor: v })}
          />

          <TextInput
            placeholder="Interés semanal (%)"
            placeholderTextColor="#666"
            style={styles.input}
            keyboardType="numeric"
            value={credito.interesSemanal}
            onChangeText={(v) => setCredito({ ...credito, interesSemanal: v })}
          />

          <TextInput
            placeholder="Fecha inicio crédito (DD/MM/AAAA)"
            placeholderTextColor="#666"
            style={styles.input}
            value={credito.fechaInicio}
            onChangeText={(v) => setCredito({ ...credito, fechaInicio: v })}
          />

          <View style={styles.item}>
            <Text>Pago semanal calculado: ${calcularPagoSemanal(credito).toLocaleString('es-AR')}</Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={guardarCredito}>
            <Text style={styles.btnText}>Guardar crédito y crear pago</Text>
          </TouchableOpacity>

        </>
      )}

      {pantalla === 'pago' && (
        <>
          <Text style={styles.title}>Nuevo pago</Text>

          <View style={styles.item}>
            <Text>Cliente: {clienteActual?.nombre}</Text>
            <Text>Contrato: {creditoActual?.contrato}</Text>
            <Text>Valor crédito: ${creditoActual?.valor}</Text>
            <Text>Interés semanal: {creditoActual?.interesSemanal}%</Text>
            <Text>Fecha inicio crédito: {creditoActual?.fechaInicio || '-'}</Text>
            <Text>Pago semanal calculado: ${calcularPagoSemanal(creditoActual).toLocaleString('es-AR')}</Text>
            <Text>Saldo acumulado actual: {dinero(calcularSaldoAcumulado(creditoActual))}</Text>
            <Text>Cuota actual: {pago.cuota} de {creditoActual?.total}</Text>
          </View>

          <TextInput
            placeholder="Monto abonado"
            placeholderTextColor="#666"
            style={styles.input}
            keyboardType="number-pad"
            value={pago.monto}
            onChangeText={(v) => setPago({ ...pago, monto: v })}
          />

          <TextInput
            placeholder="Número de cuota"
            placeholderTextColor="#666"
            style={styles.input}
            keyboardType="numeric"
            value={pago.cuota}
            onChangeText={(v) => setPago({ ...pago, cuota: v })}
          />

          <TouchableOpacity
            style={styles.input}
            onPress={() =>
              setPago({
                ...pago,
                concepto:
                  pago.concepto === 'Pago crédito semanal'
                    ? 'Pago crédito mensual'
                    : 'Pago crédito semanal'
              })
            }
          >
            <Text>{pago.concepto}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={generarComprobante}>
            <Text style={styles.btnText}>Generar comprobante</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.buttonSec} onPress={() => setPantalla('detalleCredito')}>
            <Text>Volver</Text>
          </TouchableOpacity>
        </>
      )}

      {pantalla === 'pagoGeneradoSemanal' && (
        <>
          <Text style={styles.title}>Pago generado semanal</Text>

          <View style={styles.item}>
            <Text>Cliente: {clienteActual?.nombre}</Text>
            <Text>Contrato: {creditoActual?.contrato}</Text>
            <Text>Pago esperado:</Text>
            <Text style={styles.bigNumber}>$ {calcularPagoSemanal(creditoActual).toLocaleString('es-AR')}</Text>
          </View>

          <TouchableOpacity
            style={styles.input}
            onPress={() => setMostrarSelectorSemanas(!mostrarSelectorSemanas)}
          >
            <Text style={styles.itemTitle}>Semana correspondiente</Text>
            <Text>{pagoGeneradoSemanal.semanaLabel || 'Tocar para seleccionar semana'}</Text>
          </TouchableOpacity>

          {mostrarSelectorSemanas && (
            <ScrollView
              style={styles.selectorSemanas}
              nestedScrollEnabled={true}
            >
              {obtenerSemanasDelAnio().map((semana) => (
                <TouchableOpacity
                  key={semana.id}
                  style={[
                    styles.semanaItem,
                    pagoGeneradoSemanal.semanaId === semana.id && styles.semanaItemSeleccionada
                  ]}
                  onPress={() => seleccionarSemanaPagoGenerado(semana)}
                >
                  <Text>{semana.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TextInput
            placeholder="Pago generado semanal"
            placeholderTextColor="#666"
            style={styles.input}
            keyboardType="numeric"
            value={pagoGeneradoSemanal.monto}
            onChangeText={(v) => setPagoGeneradoSemanal({ ...pagoGeneradoSemanal, monto: v })}
          />

          <TouchableOpacity style={styles.button} onPress={guardarPagoGeneradoSemanal}>
            <Text style={styles.btnText}>Guardar pago generado semanal</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.buttonSec} onPress={() => setPantalla('detalleCredito')}>
            <Text>Volver al crédito</Text>
          </TouchableOpacity>
        </>
      )}

      {pantalla === 'cobranzas' && (
        <>
          <Text style={styles.title}>Cobranzas</Text>

          <TouchableOpacity style={styles.button} onPress={() => setPantalla('recaudacion')}>
            <Text style={styles.btnText}>Recaudación</Text>
          </TouchableOpacity>

          {(() => {
            const general = calcularCobranzaHistoricaGeneral();
            return (
              <View style={styles.item}>
                <Text style={styles.itemTitle}>Resumen general histórico</Text>
                <Text>Pagos esperados: {dinero(general.esperado)}</Text>
                <Text>Pagos generados: {dinero(general.generado)}</Text>
                <Text>Porcentaje de cobranza: {general.cobranza.toFixed(1)}%</Text>
                <Text>Morosidad general: {general.morosidad.toFixed(1)}%</Text>
              </View>
            );
          })()}

          <Text style={styles.subTitle}>Clientes</Text>

          {clientes.map((c) => {
            const resumen = calcularCobranzaHistoricaCliente(c);
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.item}
                onPress={() => abrirCobranzasCliente(c)}
              >
                <Text style={styles.itemTitle}>{c.nombre}</Text>
                <Text>Semanas analizadas: {resumen.semanasAnalizadas}</Text>
                <Text>Pago esperado histórico: {dinero(resumen.esperado)}</Text>
                <Text>Pago generado histórico: {dinero(resumen.generado)}</Text>
                <Text>Porcentaje de cobranza: {resumen.cobranza.toFixed(1)}%</Text>
                <Text>Morosidad histórica: {resumen.morosidad.toFixed(1)}%</Text>
                <Text style={styles.hint}>Tocar para ver detalle por semana</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.buttonSec} onPress={() => setPantalla('clientes')}>
            <Text>Volver</Text>
          </TouchableOpacity>
        </>
      )}

      {pantalla === 'cobranzasCliente' && (
        <>
          <Text style={styles.title}>Cobranzas</Text>
          <Text style={styles.subTitle}>{clienteCobranzaActual?.nombre}</Text>

          {(() => {
            const semanas = calcularCobranzasPorSemanaCliente(clienteCobranzaActual);
            const historico = calcularCobranzaHistoricaCliente(clienteCobranzaActual);

            return (
              <>
                <View style={styles.item}>
                  <Text style={styles.itemTitle}>Resumen histórico del cliente</Text>
                  <Text>Pago esperado histórico: {dinero(historico.esperado)}</Text>
                  <Text>Pago generado histórico: {dinero(historico.generado)}</Text>
                  <Text>Porcentaje de cobranza: {historico.cobranza.toFixed(1)}%</Text>
                  <Text>Morosidad del cliente: {historico.morosidad.toFixed(1)}%</Text>
                </View>

                {semanas.length === 0 && (
                  <View style={styles.item}>
                    <Text>No hay pagos generados semanales cargados todavía.</Text>
                  </View>
                )}

                {semanas.map((semana) => (
                  <View key={semana.id} style={styles.item}>
                    <Text style={styles.itemTitle}>{semana.label}</Text>
                    <Text>Pago esperado: {dinero(semana.esperado)}</Text>
                    <Text>Pago generado: {dinero(semana.generado)}</Text>
                    <Text>Porcentaje de cobranza: {semana.cobranza.toFixed(1)}%</Text>
                    <Text>Morosidad del cliente: {semana.morosidad.toFixed(1)}%</Text>
                  </View>
                ))}
              </>
            );
          })()}

          <TouchableOpacity style={styles.buttonSec} onPress={() => setPantalla('cobranzas')}>
            <Text>Volver a cobranzas</Text>
          </TouchableOpacity>
        </>
      )}

      {pantalla === 'recaudacion' && (
        <>
          <Text style={styles.title}>Recaudación</Text>

          <TouchableOpacity
            style={styles.input}
            onPress={() => setMostrarSelectorMeses(!mostrarSelectorMeses)}
          >
            <Text style={styles.itemTitle}>Mes analizado</Text>
            <Text>{obtenerLabelMesRecaudacion()}</Text>
          </TouchableOpacity>

          {mostrarSelectorMeses && (
            <ScrollView
              style={styles.selectorSemanas}
              nestedScrollEnabled={true}
            >
              {obtenerMesesRecaudacion().map((mes) => (
                <TouchableOpacity
                  key={mes.id}
                  style={[
                    styles.semanaItem,
                    mesRecaudacion === mes.id && styles.semanaItemSeleccionada
                  ]}
                  onPress={() => {
                    setMesRecaudacion(mes.id);
                    setMostrarSelectorMeses(false);
                  }}
                >
                  <Text>{mes.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {(() => {
            const semanal = calcularRecaudacionSemanaGeneral(mesRecaudacion);
            const mensual = calcularRecaudacionMensualGeneral(mesRecaudacion);

            return (
              <>
                <View style={styles.item}>
                  <Text style={styles.itemTitle}>Semana analizada</Text>
                  <Text>{semanal.label}</Text>
                </View>

                <GraficoTortaRecaudacion
                  titulo="Gráfico semanal"
                  labelRecaudado="Recaudado semanal"
                  labelSaldo="Saldo semanal"
                  recaudado={semanal.recaudado}
                  saldo={semanal.saldo}
                  porcentajeRecaudado={semanal.porcentajeRecaudado}
                  porcentajeSaldo={semanal.porcentajeSaldo}
                />

                <GraficoTortaRecaudacion
                  titulo="Gráfico mensual"
                  labelRecaudado="Recaudado mensual"
                  labelSaldo="Saldo mensual"
                  recaudado={mensual.recaudado}
                  saldo={mensual.saldo}
                  porcentajeRecaudado={mensual.porcentajeRecaudado}
                  porcentajeSaldo={mensual.porcentajeSaldo}
                />
              </>
            );
          })()}

          <TouchableOpacity style={styles.buttonSec} onPress={() => setPantalla('cobranzas')}>
            <Text>Volver a cobranzas</Text>
          </TouchableOpacity>
        </>
      )}

      {pantalla === 'comprobante' && (
        <>
          <View ref={viewRef} collapsable={false} style={[styles.recibo, creditoCancelado && styles.reciboCancelado]}>

            <View style={styles.headerRow}>
              <View>
                <Text style={styles.logoFhz}>FHZ</Text>
                <Text style={styles.logoCredito}>CRÉDITOS</Text>
              </View>

              <View>
                <Text style={styles.titulo}>RECIBO DE PAGO</Text>
                <Text style={styles.reciboNro}>N° RECIBO: {numeroReciboActual}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text><Text style={styles.bold}>CLIENTE:</Text> {clienteActual?.nombre}</Text>
              <Text><Text style={styles.bold}>N° DE CONTRATO:</Text> {creditoActual?.contrato}</Text>
              <Text><Text style={styles.bold}>VALOR DEL CRÉDITO:</Text> ${creditoActual?.valor}</Text>
              <Text><Text style={styles.bold}>FECHA INICIO CRÉDITO:</Text> {creditoActual?.fechaInicio || '-'}</Text>
              <Text><Text style={styles.bold}>CONCEPTO:</Text> {pago.concepto}</Text>
            </View>

            <View style={styles.moneyRow}>
              <View style={styles.moneyBoxDark}>
                <Text style={styles.moneyLabelWhite}>VALOR ABONADO</Text>
                <Text style={styles.moneyWhite}>$ {pago.monto}</Text>
              </View>

              <View style={[styles.moneyBoxLight, creditoCancelado && styles.greenBox]}>
                <Text style={styles.moneyLabel}>SALDO DE LA SEMANA</Text>
                <Text style={styles.moneyBlue}>
                  {creditoCancelado ? 'CANCELADO' : dinero(comprobanteActual?.saldoAcumulado || 0)}
                </Text>
              </View>
            </View>

            <View style={[styles.cuotasBox, creditoCancelado && styles.greenBox]}>
              <View style={styles.cuotaCol}>
                <Text style={styles.bold}>CUOTAS ABONADAS</Text>
                <Text style={styles.cuotaNum}>{abonadas}</Text>
                <Text>de {total}</Text>
              </View>

              <View style={styles.cuotaCol}>
                <Text style={styles.bold}>CUOTAS RESTANTES</Text>
                <Text style={styles.cuotaNum}>{creditoCancelado ? '✔' : restantes}</Text>
                <Text>{creditoCancelado ? `${abonadas} de ${total} - CRÉDITO CANCELADO` : `de ${total}`}</Text>
              </View>
            </View>

            <View style={styles.fechaBox}>
              <Text style={styles.bold}>FECHA Y HORA DE PAGO</Text>
              <Text>{comprobanteActual?.fecha || new Date().toLocaleString()}</Text>
            </View>

            <Text style={styles.gracias}>¡Gracias por confiar en nosotros!</Text>
            <Text style={styles.footerLogo}>FHZ CRÉDITOS</Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={compartir}>
            <Text style={styles.btnText}>Compartir / WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.buttonSec} onPress={() => prepararEditarPago(comprobanteActual)}>
            <Text>Editar comprobante</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.buttonSec} onPress={() => setPantalla('detalleCredito')}>
            <Text>Ver comprobantes del crédito</Text>
          </TouchableOpacity>
        </>
      )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: { flex: 1, backgroundColor: '#eef1f5' },
  container: { flex: 1, padding: 20, backgroundColor: '#eef1f5' },
  scrollContent: { paddingBottom: 260 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 15 },
  subTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 20, marginBottom: 8 },
  input: { backgroundColor: '#fff', padding: 14, marginVertical: 7, borderRadius: 10, fontSize: 16 },
  item: { backgroundColor: '#fff', padding: 14, borderRadius: 10, marginVertical: 7 },
  itemTitle: { fontWeight: 'bold', fontSize: 16 },
  hint: { fontSize: 11, color: '#777', marginTop: 5 },
  creditoCancelado: { backgroundColor: '#d1fae5', borderWidth: 1, borderColor: '#16a34a' },
  button: { backgroundColor: '#1e3a8a', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonSec: { backgroundColor: '#ddd', padding: 13, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  bigNumber: { fontSize: 24, fontWeight: 'bold', color: '#003f9e', marginTop: 5 },
  recibo: { backgroundColor: '#fff', padding: 18, borderRadius: 18, borderWidth: 4, borderColor: '#001b44' },
  reciboCancelado: { borderColor: '#16a34a' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  logoFhz: { fontSize: 44, fontWeight: 'bold', color: '#001b44' },
  logoCredito: { fontSize: 13, letterSpacing: 5, color: '#003f9e' },
  titulo: { fontSize: 20, fontWeight: 'bold', color: '#001b44', textAlign: 'right' },
  reciboNro: { marginTop: 10, color: '#003f9e', fontWeight: 'bold', textAlign: 'right' },
  card: { borderWidth: 1, borderColor: '#ccd2dc', borderRadius: 12, padding: 14, marginBottom: 14, gap: 7 },
  bold: { fontWeight: 'bold', color: '#001b44' },
  moneyRow: { flexDirection: 'row', marginBottom: 14 },
  moneyBoxDark: { flex: 1, backgroundColor: '#001b44', padding: 14, borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  moneyBoxLight: { flex: 1, borderWidth: 1, borderColor: '#ccd2dc', padding: 14, borderTopRightRadius: 12, borderBottomRightRadius: 12 },
  greenBox: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  moneyLabelWhite: { color: '#fff', fontWeight: 'bold' },
  moneyLabel: { color: '#001b44', fontWeight: 'bold' },
  moneyWhite: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 8 },
  moneyBlue: { color: '#003f9e', fontSize: 22, fontWeight: 'bold', marginTop: 8 },
  cuotasBox: { flexDirection: 'row', borderWidth: 1, borderColor: '#ccd2dc', borderRadius: 12, padding: 12, marginBottom: 14 },
  cuotaCol: { flex: 1, alignItems: 'center' },
  cuotaNum: { fontSize: 30, fontWeight: 'bold', color: '#003f9e', marginTop: 5 },
  fechaBox: { borderWidth: 1, borderColor: '#ccd2dc', borderRadius: 12, padding: 14, marginBottom: 18 },
  gracias: { textAlign: 'center', color: '#003f9e', fontSize: 16, marginBottom: 10 },
  pieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
  },
  pieCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#dbeafe',
    borderWidth: 18,
    borderColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  piePercent: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#001b44',
  },
  pieText: {
    fontSize: 11,
    color: '#001b44',
  },
  pieLegend: {
    flex: 1,
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColorRecaudado: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#16a34a',
  },
  legendColorSaldo: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#dc2626',
  },
  selectorSemanas: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
    height: 260,
    overflow: 'hidden',
  },
  semanaItem: {
    backgroundColor: '#eef1f5',
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
  },
  semanaItemSeleccionada: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  miniButton: { backgroundColor: '#e5e7eb', padding: 9, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  miniButtonText: { color: '#001b44', fontWeight: 'bold' },
  footerLogo: { textAlign: 'center', color: '#001b44', fontWeight: 'bold', fontSize: 20 },
});
