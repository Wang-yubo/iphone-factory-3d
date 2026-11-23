import { Factory } from '@/scene/Factory'
import { Hud } from '@/ui/Hud'

export default function App() {
  return (
    <div className="app">
      <Factory />
      <Hud />
    </div>
  )
}