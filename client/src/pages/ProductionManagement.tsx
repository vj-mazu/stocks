import React from 'react';
import Locations from './Locations';

const ProductionManagement: React.FC = () => {
  return <Locations defaultTab="production" hideTabs={true} />;
};

export default ProductionManagement;
