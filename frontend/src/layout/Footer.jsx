import React from 'react';
import { useI18n } from '../i18n';

const Footer = () => {
  const { t } = useI18n();
  return (
    <footer className="footer">
      <div className="footer-content">
        <p>{t('footer.rights', { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
};

export default Footer;
