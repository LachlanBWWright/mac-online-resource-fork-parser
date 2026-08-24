import ResourceForkParser from "./components/ResourceForkParser";
import { Toaster } from "./lib/toast";

function App() {
  return (
    <>
      <ResourceForkParser />
      <Toaster 
        position="top-right"
        containerStyle={{
          top: 16,
          right: 16,
          width: 'min(384px, calc(100vw - 32px))',
        }}
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
