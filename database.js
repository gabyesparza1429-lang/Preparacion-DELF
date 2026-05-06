// 1. Conexión a tu proyecto Firebase (Debes reemplazar los datos entre comillas con los de tu consola)
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "objectif-reussite-delf.firebaseapp.com",
  projectId: "objectif-reussite-delf",
  storageBucket: "objectif-reussite-delf.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. Creación automática de la base de datos con la ficha de Constanza
async function crearPrimerAlumno() {
  try {
    await setDoc(doc(db, "Usuarios", "Constanza_B1"), {
      usuario: "Constanza",
      nivel: "B1",
      configuracion: {
        fecha_inicio: "2026-05-06",
        fecha_vencimiento: "2026-08-06",
        fecha_examen_delf: "pendiente"
      },
      progreso_pedagogico: {
        comprension_oral: 0,
        comprension_escrita: 0,
        produccion_oral: 0,
        produccion_escrita: 0,
        ejercicios_completados_porcentaje: 0
      },
      estatus_ia: "esperando_datos"
    });
    console.log("Base de datos creada y Constanza registrada con éxito.");
  } catch (error) {
    console.error("Error al crear la base de datos: ", error);
  }
}

crearPrimerAlumno();
