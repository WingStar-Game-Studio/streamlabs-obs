import TsxComponent, { createProps } from 'components/tsx-component';
import { $t } from 'services/i18n';
import { Component } from 'vue-property-decorator';
import styles from './GoLive.m.less';
import { Inject } from 'services/core';
import { UserService } from 'services/user';
import { TPlatform } from 'services/platforms';
import { SettingsService } from 'services/settings';
import { IGoLiveSettings, StreamingService } from 'services/streaming';
import { Spinner } from 'streamlabs-beaker';
import { StreamSettingsService } from 'services/settings/streaming';
import ValidatedForm from 'components/shared/inputs/ValidatedForm';
import PlatformSettings from './PlatformSettings';
import GoLiveError from './GoLiveError';
import { SyncWithValue } from 'services/app/app-decorators';
import { OptimizedProfileSwitcher } from './OptimizedProfileSwitcher';
import { DestinationSwitchers } from './DestinationSwitchers';
import { Twitter } from 'components/Twitter';
import { RestreamService } from 'services/restream';
import Section from './Section';

class GoLiveProps {
  value?: IGoLiveSettings = undefined;
}

/**
 * Renders settings for starting the stream
 * - Platform switchers
 * - Settings for each platform
 * - Extras settings
 **/
@Component({ props: createProps(GoLiveProps) })
export default class GoLiveSettings extends TsxComponent<GoLiveProps> {
  @Inject() private streamingService: StreamingService;
  @Inject() private streamSettingsService: StreamSettingsService;
  @Inject() private settingsService: SettingsService;
  @Inject() private userService: UserService;
  @Inject() private restreamService: RestreamService;
  @SyncWithValue() private settings: IGoLiveSettings;

  private get view() {
    return this.streamingService.views;
  }

  private switchPlatform(platform: TPlatform, enabled: boolean) {
    // save settings
    this.settings.platforms[platform].enabled = enabled;
    this.streamSettingsService.setGoLiveSettings(this.settings);

    // preload channel data
    this.streamingService.actions.prepopulateInfo();
  }

  private addDestination() {
    // open the stream settings or prime page
    if (this.restreamService.canEnableRestream) {
      this.settingsService.actions.showSettings('Stream');
    } else {
      this.userService.openPrimeUrl('slobs-multistream');
    }
  }

  private render() {
    const view = this.view;
    const enabledPlatforms = view.enabledPlatforms;
    const hasPlatforms = enabledPlatforms.length > 0;
    const isErrorMode = view.info.error;
    const isLoadingMode = !isErrorMode && ['empty', 'prepopulate'].includes(view.info.lifecycle);
    const shouldShowSettings = !isErrorMode && !isLoadingMode && hasPlatforms;
    const isAdvancedMode = view.goLiveSettings.advancedMode && view.isMutliplatformMode;
    const shouldShowAddDestination = view.allPlatforms.length !== view.linkedPlatforms.length;
    const shouldShowPrimeLabel = !this.restreamService.state.grandfathered;
    const shouldShowLeftCol = this.streamSettingsService.state.protectedModeEnabled;
    return (
      <ValidatedForm class="flex">
        {/*LEFT COLUMN*/}
        {shouldShowLeftCol && (
          <div style={{ width: '400px', marginRight: '42px' }}>
            {/*DESTINATION SWITCHERS*/}
            <DestinationSwitchers
              value={this.settings.platforms}
              title="Stream to %{platformName}"
              canDisablePrimary={false}
              handleOnSwitch={(...args) => this.switchPlatform(...args)}
            />

            {/*ADD DESTINATION BUTTON*/}
            {shouldShowAddDestination && (
              <a class={styles.addDestinationBtn} onclick={this.addDestination}>
                <i class="fa fa-plus" />
                {$t('Add Destination')} {shouldShowPrimeLabel && <b class={styles.prime}>prime</b>}
              </a>
            )}
          </div>
        )}

        {/*RIGHT COLUMN*/}
        <div style={{ width: '100%' }}>
          {isLoadingMode && this.renderLoading()}
          <GoLiveError />

          {shouldShowSettings && (
            <div class={styles.settingsContainer}>
              {/*PLATFORM SETTINGS*/}
              <PlatformSettings vModel={this.settings} />

              {/*ADD SOME SPACE*/}
              {!isAdvancedMode && <div class={styles.spacer} />}

              {/*EXTRAS*/}
              <Section title={isAdvancedMode ? $t('Extras') : ''}>
                <Twitter
                  vModel={this.settings.tweetText}
                  streamTitle={this.view.getCommonFields(this.settings).title}
                />
                <OptimizedProfileSwitcher
                  vModel={this.settings.optimizedProfile}
                  settings={this.settings}
                />
              </Section>
            </div>
          )}
        </div>
      </ValidatedForm>
    );
  }

  private renderLoading() {
    return <Spinner />;
  }
}