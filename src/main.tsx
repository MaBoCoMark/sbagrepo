import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { setupGlobalErrorHandlers } from './utils/bootstrap';
import './index.css';

// 初始化全局异常捕获
setupGlobalErrorHandlers();

// 挂载 React 根节点
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
