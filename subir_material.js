import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCgog8tKspHy01ZHE8Dthl9O4W6lw1a_Ec",
  authDomain: "objectif-reussite-delf.firebaseapp.com",
  projectId: "objectif-reussite-delf",
  storageBucket: "objectif-reussite-delf.firebasestorage.app",
  messagingSenderId: "942279633770",
  appId: "1:942279633770:web:9d7b5fe54d0139019c1313"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// AQUÍ AGREGAMOS EL MATERIAL QUE TIENES
const materialesB1 = [
  {
    id: "comprension_escrita_1",
    titulo: "Examen de Práctica - Comprensión Escrita",
    tipo: "Lectura",
    url: "Pega_aquí_el_link_de_tu_material"
  },
  {
    id: "comprension_oral_1",
    titulo: "Audio de Práctica - Comprensión Oral",
    tipo: "Audio",
    url: "Pega_aquí_el_link_de_tu_audio"
  }
];

async function subirMaterial() {
  for (const item of materialesB1) {
    try {
      await setDoc(doc(db, "Material_B1", item.id), item);
      console.log(`Subido: ${item.titulo}`);
    } catch (e) {
      console.error("Error al subir: ", e);
    }
  }
  alert("¡Material subido con éxito a Firebase!");
}

subirMaterial();
