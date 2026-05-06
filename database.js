import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// 1. Configuración oficial de tu proyecto
const firebaseConfig = {
  apiKey: "AIzaSyCgog8tKspHy01ZHE8Dthl9O4W6lw1a_Ec",
  authDomain: "objectif-reussite-delf.firebaseapp.com",
  projectId: "objectif-reussite-delf",
  storageBucket: "objectif-reussite-delf.firebasestorage.app",
  messagingSenderId: "942279633770",
  appId: "1:942279633770:web:9d7b5fe54d0139019c1313",
  measurementId: "G-MW6BHVYVKE"
};

// 2. Inicializar conexión
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3. Función para registrar alumnos y crear la base de datos
async function registrarAlumno(nombre, nivel) {
  try {
    const fechaInicio = new Date();
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaInicio.getDate() + 90); // Regla de los 3 meses

    await setDoc(doc(db, "Usuarios", nombre), {
      usuario: nombre,
      nivel: nivel,
      configuracion: {
        fecha_inicio: fechaInicio.toISOString().split('T')[0],
        fecha_vencimiento: fechaVencimiento.toISOString().split('T')[0],
        fecha_examen_delf: "pendiente"
      },
      progreso_pedagogico: {
        comprension_oral: 0,
        comprension_escrita: 0,
        produccion_oral: 0,
        produccion_escrita: 0,
        promedio_general: 0,
        ejercicios_completados: 0
      },
      estatus_ia: "esperando_datos"
    });
    console.log("Registro exitoso en Firebase.");
  } catch (error) {
    console.error("Error al registrar:", error);
  }
}

// Ejecutar registro de prueba
registrarAlumno("Constanza", "B1");
