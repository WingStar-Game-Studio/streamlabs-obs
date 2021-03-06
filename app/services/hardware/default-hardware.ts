import { PersistentStatefulService } from 'services/core/persistent-stateful-service';
import { EDeviceType, HardwareService } from './hardware';
import { Inject } from 'services/core/injector';
import { AudioService, E_AUDIO_CHANNELS } from 'services/audio';
import { SourcesService, ISourceAddOptions } from 'services/sources';
import { mutation } from 'services/core';
import { SceneCollectionsService } from 'services/scene-collections';
import { byOS, OS } from 'util/operating-systems';

interface IDefaultHardwareServiceState {
  defaultVideoDevice: string;
  defaultAudioDevice: string;
}

export class DefaultHardwareService extends PersistentStatefulService<
  IDefaultHardwareServiceState
> {
  static defaultState: IDefaultHardwareServiceState = {
    defaultVideoDevice: null,
    defaultAudioDevice: 'default',
  };

  @Inject() private hardwareService: HardwareService;
  @Inject() private audioService: AudioService;
  @Inject() private sourcesService: SourcesService;
  @Inject() private sceneCollectionsService: SceneCollectionsService;

  init() {
    super.init();
  }

  createTemporarySources() {
    this.audioDevices.forEach(device => {
      this.sourcesService.createSource(
        device.id,
        byOS({ [OS.Windows]: 'wasapi_input_capture', [OS.Mac]: 'coreaudio_input_capture' }),
        { device_id: device.id },
        {
          isTemporary: true,
          sourceId: device.id,
        } as ISourceAddOptions,
      );
    });

    this.videoDevices.forEach(device => {
      const existingSource = this.existingVideoDeviceSources.find(
        source => source.deviceId === device.id,
      );
      if (existingSource) return;
      if (!device.id) return;
      this.sourcesService.createSource(
        device.id,
        byOS({ [OS.Windows]: 'dshow_input', [OS.Mac]: 'av_capture_input' }),
        byOS({ [OS.Windows]: { video_device_id: device.id }, [OS.Mac]: { device: device.id } }),
        {
          isTemporary: true,
          sourceId: device.id,
        } as ISourceAddOptions,
      );
    });

    if (this.videoDevices[0]) this.SET_DEVICE('video', this.videoDevices[0].id);
  }

  get existingVideoDeviceSources() {
    const deviceProperty = byOS({ [OS.Windows]: 'video_device_id', [OS.Mac]: 'device' });

    return this.sourcesService.views.sources
      .filter(
        source =>
          source.type === byOS({ [OS.Windows]: 'dshow_input', [OS.Mac]: 'av_capture_input' }) &&
          this.videoDevices.find(device => device.id === source.getSettings()[deviceProperty]),
      )
      .map(source => ({
        source,
        deviceId: source.getSettings()[deviceProperty],
      }));
  }

  clearTemporarySources() {
    this.audioDevices.forEach(device => {
      this.sourcesService.removeSource(device.id);
    });

    this.videoDevices.forEach(device => {
      const existingSource = this.existingVideoDeviceSources.find(
        source => source.deviceId === device.id,
      );
      if (existingSource) return;
      this.sourcesService.removeSource(device.id);
    });
  }

  get videoDevices() {
    return this.hardwareService
      .getDshowDevices()
      .filter(device => EDeviceType.videoInput === device.type);
  }

  get audioDevices() {
    return this.audioService.getDevices().filter(device => device.type === EDeviceType.audioInput);
  }

  get selectedAudioSource() {
    if (!this.state.defaultAudioDevice) return;
    return this.audioService.views.getSource(this.state.defaultAudioDevice);
  }

  get selectedVideoSource() {
    if (!this.state.defaultVideoDevice) return;
    const existingSource = this.existingVideoDeviceSources.find(
      source => source.deviceId === this.state.defaultVideoDevice,
    );
    if (existingSource) return existingSource.source;
    return this.sourcesService.views.getSource(this.state.defaultVideoDevice);
  }

  setSceneCollectionAudio(id: string) {
    const collectionManifest = this.sceneCollectionsService.collections.find(
      collection => collection.auto,
    );

    const audioSource = this.sourcesService.views.sources.find(
      source => source.channel === E_AUDIO_CHANNELS.INPUT_1,
    );
    if (
      audioSource &&
      collectionManifest &&
      this.sceneCollectionsService.activeCollection.id === collectionManifest.id
    ) {
      audioSource.updateSettings({ device_id: id });
    }
  }

  setDefault(type: 'audio' | 'video', id: string) {
    this.SET_DEVICE(type, id);
    if (type === 'audio') {
      this.setSceneCollectionAudio(id);
    }
  }

  @mutation()
  private SET_DEVICE(type: string, id: string) {
    if (type === 'video') {
      this.state.defaultVideoDevice = id;
    } else {
      this.state.defaultAudioDevice = id;
    }
  }
}
