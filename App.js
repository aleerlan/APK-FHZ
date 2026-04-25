import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const viewRef = useRef(null);

  const [pantalla, setPantalla] = useState('clientes');
  const [clientes, setClientes] = useState([]);
  const [clienteActual, setClienteActual] = useState(null);
  const [creditoActual, setCreditoActual] = useState(null);
  const [comprobanteActual, setComprobanteActual] = useState(null);

  const [nuevoCliente, setNuevoCliente] = useState('');
  const [contadorRecibo, setContadorRecibo] = useState(112);
  const [numeroReciboActual, setNumeroReciboActual] = useState('');

  const [credito, setCredito] = useState({
    contrato: '',
    total: '',
    valor: ''
  });

  const [pago, setPago] = useState({
    monto: '',
    cuota: '',
    concepto: 'Pago crédito semanal'
  });

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
          pagos: Array.isArray(cr.pagos) ? cr.pagos : []
        })) : []
      }));
      setClientes(normalizados);
    }

    if (recibo) setContadorRecibo(parseInt(recibo) || 112);
  };

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
    if (!credito.contrato || !credito.total || !credito.valor) {
      Alert.alert('Faltan datos', 'Completá contrato, cuotas y valor del crédito.');
      return;
    }

    const nuevoCredito = {
      id: Date.now().toString(),
      contrato: credito.contrato,
      total: credito.total,
      valor: credito.valor,
      pagos: []
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
    setCredito({ contrato: '', total: '', valor: '' });

    setPago({
      monto: '',
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
      monto: '',
      cuota: String(pagos.length + 1),
      concepto: 'Pago crédito semanal'
    });

    setPantalla('pago');
  };

  const generarComprobante = () => {
    if (!pago.monto) {
      Alert.alert('Falta el monto', 'Ingresá el monto abonado.');
      return;
    }

    const nro = `001-${String(contadorRecibo).padStart(6, '0')}`;
    setNumeroReciboActual(nro);
    setContadorRecibo(contadorRecibo + 1);

    const pagoNuevo = {
      ...pago,
      recibo: nro,
      fecha: new Date().toLocaleString()
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

  const total = parseInt(creditoActual?.total) || 0;
  const abonadas = parseInt(pago.cuota) || 0;
  const restantes = total - abonadas;
  const creditoCancelado = restantes <= 0;

  return (
    <ScrollView style={styles.container}>

      {pantalla === 'clientes' && (
        <>
          <Text style={styles.title}>FHZ CRÉDITOS</Text>

          {clientes.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.item}
              onPress={() => abrirCliente(c)}
              onLongPress={() => eliminarCliente(c.id)}
            >
              <Text style={styles.itemTitle}>{c.nombre}</Text>
              <Text>Créditos: {(c.creditos || []).length}</Text>
              <Text style={styles.hint}>Mantener presionado para eliminar</Text>
            </TouchableOpacity>
          ))}

          <TextInput
            placeholder="Nombre del cliente"
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
                <Text>{pagadas} de {cr.total}</Text>
                <Text>{cancelado ? 'CRÉDITO CANCELADO' : `Cuotas restantes: ${quedan}`}</Text>
                <Text style={styles.hint}>Mantener presionado para eliminar</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.button} onPress={() => setPantalla('credito')}>
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
            <Text>Cuotas: {(creditoActual?.pagos || []).length} de {creditoActual?.total}</Text>
            <Text>
              {(creditoActual?.pagos || []).length >= parseInt(creditoActual?.total || 0)
                ? 'CRÉDITO CANCELADO'
                : `Restantes: ${(parseInt(creditoActual?.total) || 0) - (creditoActual?.pagos || []).length}`}
            </Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={irANuevoPago}>
            <Text style={styles.btnText}>Nuevo pago</Text>
          </TouchableOpacity>

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
              <Text>Cuota: {p.cuota} de {creditoActual?.total}</Text>
              <Text>{p.fecha}</Text>
              <Text style={styles.hint}>Mantener presionado para eliminar</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.buttonSec} onPress={() => setPantalla('detalleCliente')}>
            <Text>Volver al cliente</Text>
          </TouchableOpacity>
        </>
      )}

      {pantalla === 'credito' && (
        <>
          <Text style={styles.title}>Nuevo crédito</Text>

          <TextInput
            placeholder="Contrato"
            style={styles.input}
            value={credito.contrato}
            onChangeText={(v) => setCredito({ ...credito, contrato: v })}
          />

          <TextInput
            placeholder="Total cuotas"
            style={styles.input}
            keyboardType="numeric"
            value={credito.total}
            onChangeText={(v) => setCredito({ ...credito, total: v })}
          />

          <TextInput
            placeholder="Valor crédito"
            style={styles.input}
            value={credito.valor}
            onChangeText={(v) => setCredito({ ...credito, valor: v })}
          />

          <TouchableOpacity style={styles.button} onPress={guardarCredito}>
            <Text style={styles.btnText}>Guardar crédito y crear pago</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.buttonSec} onPress={() => setPantalla('detalleCliente')}>
            <Text>Volver</Text>
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
            <Text>Cuota actual: {pago.cuota} de {creditoActual?.total}</Text>
          </View>

          <TextInput
            placeholder="Monto abonado"
            style={styles.input}
            value={pago.monto}
            onChangeText={(v) => setPago({ ...pago, monto: v })}
          />

          <TextInput
            placeholder="Número de cuota"
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
                  {creditoCancelado ? 'CANCELADO' : '$ 0,00'}
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

          <TouchableOpacity style={styles.buttonSec} onPress={() => setPantalla('detalleCredito')}>
            <Text>Ver comprobantes del crédito</Text>
          </TouchableOpacity>
        </>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#eef1f5' },
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
  footerLogo: { textAlign: 'center', color: '#001b44', fontWeight: 'bold', fontSize: 20 },
});