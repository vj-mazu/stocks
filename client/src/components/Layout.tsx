import React, { ReactNode } from 'react';
import styled from 'styled-components';
import Navbar from './Navbar';
import MobileViewEnhancer from './MobileViewEnhancer';

interface LayoutProps {
  children: ReactNode;
}

const LayoutContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  /* clip (modern browsers) doesn't create a scroll container, so the sticky
     navbar + mobile card header strip keep working while scrolling */
  overflow-x: clip;
`;

const MainContent = styled.main`
  flex: 1;
  padding: 1rem;
  width: 100%;
  margin: 0 auto;
  max-width: 100%;

  @media (max-width: 768px) {
    padding: 0.625rem;
  }

  @media (max-width: 480px) {
    padding: 0.5rem;
  }
`;

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <LayoutContainer>
      <MobileViewEnhancer />
      <Navbar />
      <MainContent>
        {children}
      </MainContent>
    </LayoutContainer>
  );
};

export default Layout;