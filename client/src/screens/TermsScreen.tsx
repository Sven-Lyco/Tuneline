import { LegalPage, Operator } from '../components/LegalPage';
import { SOURCE_URL } from '../constants';
import { useLegalInfo } from '../hooks/useLegalInfo';

interface TermsScreenProps {
  onBack: () => void;
}

/** Spotify's Developer Terms (V.11) set the minimum content of these terms. */
export function TermsScreen({ onBack }: TermsScreenProps) {
  const info = useLegalInfo();
  return (
    <LegalPage title="Nutzungsbedingungen" onBack={onBack}>
      <p>Mit dem Spotify-Login oder dem Beitritt zu einem Raum akzeptierst du diese Bedingungen.</p>

      <h2>Was Tuneline ist</h2>
      <p>
        Tuneline ist ein privates, nicht-kommerzielles Hobbyprojekt. Es steht in keiner Verbindung
        zu Spotify oder Apple und wird von ihnen weder unterstützt noch empfohlen. Song-Infos und
        Cover kommen von Spotify, die Hörproben von iTunes (Apple).
      </p>

      <h2>Keine Gewährleistung</h2>
      <p>
        Die Nutzung erfolgt auf eigene Gefahr und ohne Gewähr, etwa für Verfügbarkeit oder richtige
        Erscheinungsjahre. Der Betreiber gibt keine Zusicherungen oder Gewährleistungen im Namen von
        Spotify ab. Stillschweigende Gewährleistungen, etwa für Marktgängigkeit, die Eignung für
        einen bestimmten Zweck oder die Nichtverletzung von Rechten Dritter, sind ausgeschlossen,
        soweit das gesetzlich zulässig ist.
      </p>

      <h2>Spotify-Inhalte</h2>
      <ul>
        <li>
          Du darfst die Spotify-Plattform, den Spotify-Dienst und Spotify-Inhalte nicht verändern
          und keine abgeleiteten Werke daraus erstellen.
        </li>
        <li>
          Du darfst sie nicht dekompilieren, zurückentwickeln (Reverse Engineering) oder
          disassemblieren, soweit das Gesetz es nicht ausdrücklich erlaubt.
        </li>
      </ul>

      <h2>Verantwortung</h2>
      <p>
        Für Tuneline ist allein der Betreiber verantwortlich. Spotify haftet dir gegenüber nicht für
        Tuneline.
      </p>
      <p>
        <Operator info={info} />
      </p>

      <h2>Spotify als begünstigter Dritter</h2>
      <p>
        Spotify ist begünstigter Dritter dieser Nutzungsbedingungen und der Datenschutzerklärung und
        kann sie unmittelbar durchsetzen.
      </p>

      <h2>Fair spielen</h2>
      <p>
        Wähl einen Spielernamen, der niemanden beleidigt. Wer einen Raum erstellt, kann Mitspielende
        entfernen.
      </p>

      <h2>Quellcode</h2>
      <p>
        Tuneline ist Open Source (MIT-Lizenz):{' '}
        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        .
      </p>

      <p>Stand: Oktober 2026</p>
    </LegalPage>
  );
}
