import { useState } from "react";
import WhatsInItForThe66 from "./components/WhatsInITForThe66";
import SixerScrollReveal from "./components/SixerScrollReveal";

function App() {
  const [showReveal, setShowReveal] = useState(false);

  return (
    <>
      {/* Header component goes here, rendered above both sections */}
      {!showReveal && (
        <WhatsInItForThe66 onComplete={() => setShowReveal(true)} />
      )}
      {showReveal && <SixerScrollReveal />}
    </>
  );
}

export default App;