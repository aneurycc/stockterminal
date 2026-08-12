import React from 'react';

const COLORS = ['#21BA45', '#C10015', '#9E9E9E', '#F2C037', '#FF9800', '#43B02A'];

const KPICards = ({ totalItems, operativosItems, danadosItems, prestadosItems }) => {
  return (
    <div className="kpi-grid no-print">
      <div className="kpi-card" style={{ borderBottomColor: '#3498db' }}>
         <span className="kpi-title">Total Equipos</span>
         <h3 className="kpi-value">{totalItems}</h3>
      </div>
      <div className="kpi-card" style={{ borderBottomColor: '#27ae60' }}>
         <span className="kpi-title">Operativos</span>
         <h3 className="kpi-value" style={{ color: '#27ae60' }}>{operativosItems}</h3>
      </div>
      <div className="kpi-card" style={{ borderBottomColor: '#e74c3c' }}>
         <span className="kpi-title">Dañados</span>
         <h3 className="kpi-value" style={{ color: '#e74c3c' }}>{danadosItems}</h3>
      </div>
      <div className="kpi-card" style={{ borderBottomColor: '#f39c12' }} title="Equipos prestados a otras áreas/terminales">
         <span className="kpi-title">Prestados (Out)</span>
         <h3 className="kpi-value" style={{ color: '#f39c12' }}>{prestadosItems}</h3>
      </div>
    </div>
  );
};

export default KPICards;
