import { Route, Routes } from 'react-router-dom'
import Admin from './pages/Admin'
import Attempt from './pages/Attempt'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Attempt />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  )
}
