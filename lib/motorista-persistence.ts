// Uma única origem de persistência: o Firebase real do Motorista.
export {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  runTransaction,
  writeBatch,
} from "firebase/firestore";
