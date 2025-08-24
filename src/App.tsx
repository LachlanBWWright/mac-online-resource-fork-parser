import ResourceForkParser from "./components/ResourceForkParser";
import { Toaster } from "./lib/toast";
import "./App.css";

function App() {
  return (
    <>
      <ResourceForkParser />
      <Toaster 
        position="top-right"
        toastOptions={{
          className: '',
          style: {
            background: 'transparent',
            boxShadow: 'none',
          },
        }}
      />
    </>
  );
}

export default App;
